package br.com.malhet.campo;

import android.nfc.NdefMessage;
import android.nfc.NdefRecord;
import android.nfc.NfcAdapter;
import android.nfc.Tag;
import android.nfc.tech.Ndef;
import android.nfc.tech.NdefFormatable;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Locale;

/**
 * Leitor de crachá NFC do app de campo no Android (spec 085). Dentro do app a WebView não tem Web NFC (só o Chrome
 * tem), então o mesmo plugin do iPhone lê aqui pelo "reader mode": número do crachá (UID, igual ao serialNumber do
 * Web NFC: "04:a2:…") e o texto/link gravado. Também grava o link da Presença no crachá.
 */
@CapacitorPlugin(name = "NfcCracha")
public class NfcCrachaPlugin extends Plugin implements NfcAdapter.ReaderCallback {

    private static final int FLAGS = NfcAdapter.FLAG_READER_NFC_A | NfcAdapter.FLAG_READER_NFC_B
            | NfcAdapter.FLAG_READER_NFC_F | NfcAdapter.FLAG_READER_NFC_V | NfcAdapter.FLAG_READER_NO_PLATFORM_SOUNDS;

    private PluginCall leitura;
    private PluginCall gravacao;
    private boolean continuo = true;
    private boolean ativo = false;

    private NfcAdapter adaptador() {
        return NfcAdapter.getDefaultAdapter(getContext());
    }

    @PluginMethod
    public void disponivel(PluginCall call) {
        NfcAdapter a = adaptador();
        JSObject r = new JSObject();
        r.put("disponivel", a != null && a.isEnabled());
        r.put("existe", a != null);
        r.put("plataforma", "android");
        call.resolve(r);
    }

    @PluginMethod(returnType = PluginMethod.RETURN_CALLBACK)
    public void ler(PluginCall call) {
        NfcAdapter a = adaptador();
        if (a == null) { call.reject("Este celular não tem NFC."); return; }
        if (!a.isEnabled()) { call.reject("Ligue o NFC nas configurações do celular."); return; }
        soltarLeitura();
        call.setKeepAlive(true);
        leitura = call;
        continuo = call.getBoolean("continuo", true);
        ativar();
    }

    @PluginMethod
    public void parar(PluginCall call) {
        desativar();
        soltarLeitura();
        call.resolve();
    }

    @PluginMethod
    public void gravarUrl(PluginCall call) {
        NfcAdapter a = adaptador();
        if (a == null || !a.isEnabled()) { call.reject("NFC indisponível ou desligado."); return; }
        if (call.getString("url", "").isEmpty()) { call.reject("Informe o link a gravar."); return; }
        gravacao = call;
        ativar();
    }

    private void ativar() {
        getActivity().runOnUiThread(() -> {
            NfcAdapter a = adaptador();
            if (a != null) { a.enableReaderMode(getActivity(), this, FLAGS, null); ativo = true; }
        });
    }

    private void desativar() {
        getActivity().runOnUiThread(() -> {
            NfcAdapter a = adaptador();
            if (a != null && ativo) { a.disableReaderMode(getActivity()); }
            ativo = false;
        });
    }

    private void soltarLeitura() {
        if (leitura != null) { leitura.setKeepAlive(false); getBridge().releaseCall(leitura); }
        leitura = null;
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        if (leitura != null || gravacao != null) ativar(); // o reader mode cai quando o app vai para o fundo
    }

    @Override
    protected void handleOnPause() {
        super.handleOnPause();
        if (ativo) { NfcAdapter a = adaptador(); if (a != null) a.disableReaderMode(getActivity()); ativo = false; }
    }

    static String hex(byte[] id) {
        if (id == null) return null;
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < id.length; i++) {
            if (i > 0) sb.append(':');
            sb.append(String.format(Locale.ROOT, "%02x", id[i]));
        }
        return sb.toString();
    }

    static String textoDoRegistro(NdefRecord r) {
        try {
            if (r.getTnf() == NdefRecord.TNF_WELL_KNOWN && Arrays.equals(r.getType(), NdefRecord.RTD_URI)) {
                return r.toUri() != null ? r.toUri().toString() : null;
            }
            if (r.getTnf() == NdefRecord.TNF_ABSOLUTE_URI) return new String(r.getPayload(), StandardCharsets.UTF_8);
            if (r.getTnf() == NdefRecord.TNF_WELL_KNOWN && Arrays.equals(r.getType(), NdefRecord.RTD_TEXT)) {
                byte[] p = r.getPayload();
                int idioma = p[0] & 0x3F;
                boolean utf16 = (p[0] & 0x80) != 0;
                return new String(p, 1 + idioma, p.length - 1 - idioma, utf16 ? StandardCharsets.UTF_16 : StandardCharsets.UTF_8);
            }
            if (r.getTnf() == NdefRecord.TNF_MIME_MEDIA) return new String(r.getPayload(), StandardCharsets.UTF_8);
        } catch (Exception ignorado) {
            // registro malformado: ignora só ele
        }
        return null;
    }

    @Override
    public void onTagDiscovered(Tag tag) {
        String serial = hex(tag.getId());
        if (gravacao != null) { gravar(tag, serial); return; }
        if (leitura == null) return;
        JSArray textos = new JSArray();
        Ndef ndef = Ndef.get(tag);
        if (ndef != null) {
            NdefMessage m = ndef.getCachedNdefMessage();
            if (m != null) for (NdefRecord r : m.getRecords()) { String t = textoDoRegistro(r); if (t != null && !t.isEmpty()) textos.put(t); }
        }
        JSObject r = new JSObject();
        r.put("serial", serial);
        r.put("textos", textos);
        leitura.resolve(r);
        if (!continuo) { desativar(); soltarLeitura(); }
    }

    private void gravar(Tag tag, String serial) {
        PluginCall call = gravacao;
        gravacao = null;
        try {
            NdefMessage msg = new NdefMessage(new NdefRecord[] { NdefRecord.createUri(call.getString("url")) });
            Ndef ndef = Ndef.get(tag);
            if (ndef != null) {
                ndef.connect();
                if (!ndef.isWritable()) { ndef.close(); call.reject("Crachá protegido contra gravação."); return; }
                ndef.writeNdefMessage(msg);
                ndef.close();
            } else {
                NdefFormatable f = NdefFormatable.get(tag);
                if (f == null) { call.reject("Este crachá não aceita gravação (sem NDEF)."); return; }
                f.connect();
                f.format(msg);
                f.close();
            }
            JSObject r = new JSObject();
            r.put("serial", serial);
            call.resolve(r);
        } catch (Exception e) {
            call.reject("Falhou ao gravar: " + e.getMessage());
        } finally {
            if (leitura == null) desativar();
        }
    }
}
