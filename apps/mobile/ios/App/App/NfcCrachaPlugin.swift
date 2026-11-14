import Capacitor
import CoreNFC
import Foundation

/// Leitor de crachá NFC do app de campo (spec 085). A Apple não deixa site nenhum ler NFC; dentro do app o Core NFC lê
/// o número do crachá (UID — o mesmo `serialNumber` do Web NFC no Android, "04:a2:…") e o texto/link gravado nele.
/// Modo contínuo: depois de cada leitura a janela do iOS continua aberta (`restartPolling`) para o próximo crachá —
/// a sessão do iOS dura no máximo 60 s; quando fecha, a tela avisa e o usuário toca de novo.
@objc(NfcCrachaPlugin)
public class NfcCrachaPlugin: CAPPlugin, CAPBridgedPlugin, NFCTagReaderSessionDelegate {
    public let identifier = "NfcCrachaPlugin"
    public let jsName = "NfcCracha"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "disponivel", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "ler", returnType: CAPPluginReturnCallback),
        CAPPluginMethod(name: "parar", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "gravarUrl", returnType: CAPPluginReturnPromise),
    ]

    private var sessao: NFCTagReaderSession?
    private var leitura: CAPPluginCall?
    private var gravacao: CAPPluginCall?
    private var continuo = true

    @objc func disponivel(_ call: CAPPluginCall) {
        call.resolve(["disponivel": NFCTagReaderSession.readingAvailable, "plataforma": "ios"])
    }

    @objc func ler(_ call: CAPPluginCall) {
        guard NFCTagReaderSession.readingAvailable else {
            call.reject("Este iPhone não tem leitor NFC (iPhone 7 ou mais novo).")
            return
        }
        encerrarLeitura()
        call.keepAlive = true
        leitura = call
        continuo = call.getBool("continuo") ?? true
        iniciar(call.getString("mensagem") ?? "Aproxime o crachá da parte de cima do iPhone")
    }

    @objc func parar(_ call: CAPPluginCall) {
        sessao?.invalidate()
        sessao = nil
        encerrarLeitura()
        call.resolve()
    }

    @objc func gravarUrl(_ call: CAPPluginCall) {
        guard NFCTagReaderSession.readingAvailable else {
            call.reject("Este iPhone não tem leitor NFC.")
            return
        }
        guard let url = call.getString("url"), !url.isEmpty else {
            call.reject("Informe o link a gravar.")
            return
        }
        gravacao = call
        iniciar("Aproxime o crachá para gravar o link")
    }

    private func iniciar(_ mensagem: String) {
        DispatchQueue.main.async {
            self.sessao?.invalidate()
            self.sessao = NFCTagReaderSession(pollingOption: [.iso14443, .iso15693], delegate: self, queue: nil)
            self.sessao?.alertMessage = mensagem
            self.sessao?.begin()
        }
    }

    private func encerrarLeitura() {
        if let c = leitura {
            c.keepAlive = false
            bridge?.releaseCall(c)
        }
        leitura = nil
    }

    // MARK: - NFCTagReaderSessionDelegate

    public func tagReaderSessionDidBecomeActive(_ session: NFCTagReaderSession) {}

    public func tagReaderSession(_ session: NFCTagReaderSession, didInvalidateWithError error: Error) {
        let codigo = (error as? NFCReaderError)?.code
        let motivo: String
        switch codigo {
        case .readerSessionInvalidationErrorUserCanceled: motivo = "cancelado"
        case .readerSessionInvalidationErrorSessionTimeout: motivo = "tempo"
        case .readerSessionInvalidationErrorFirstNDEFTagRead: motivo = "lido"
        default: motivo = error.localizedDescription
        }
        if let g = gravacao {
            g.reject("Gravação não concluída: \(motivo)")
            gravacao = nil
        }
        // avisa a tela que a janela do iOS fechou (o usuário toca de novo para continuar)
        leitura?.resolve(["fim": true, "motivo": motivo])
        encerrarLeitura()
        sessao = nil
    }

    public func tagReaderSession(_ session: NFCTagReaderSession, didDetect tags: [NFCTag]) {
        guard let tag = tags.first else { return }
        session.connect(to: tag) { erro in
            if erro != nil {
                session.alertMessage = "Não consegui ler. Aproxime de novo, devagar."
                session.restartPolling()
                return
            }
            var uid: Data?
            var ndef: NFCNDEFTag?
            switch tag {
            case let .miFare(t): uid = t.identifier; ndef = t
            case let .iso7816(t): uid = t.identifier; ndef = t
            case let .iso15693(t): uid = t.identifier; ndef = t
            case let .feliCa(t): uid = t.currentIDm; ndef = t
            @unknown default: break
            }
            let serial = uid.map { $0.map { String(format: "%02x", $0) }.joined(separator: ":") }
            if let g = self.gravacao {
                self.gravar(session: session, ndef: ndef, url: g.getString("url") ?? "", serial: serial, call: g)
                return
            }
            guard let ndef = ndef else {
                self.entregar(session: session, serial: serial, textos: [])
                return
            }
            ndef.readNDEF { mensagem, _ in
                let textos: [String] = (mensagem?.records ?? []).compactMap { r in
                    if let u = r.wellKnownTypeURIPayload() { return u.absoluteString }
                    let (texto, _) = r.wellKnownTypeTextPayload()
                    return texto
                }
                self.entregar(session: session, serial: serial, textos: textos)
            }
        }
    }

    private func entregar(session: NFCTagReaderSession, serial: String?, textos: [String]) {
        leitura?.resolve(["serial": serial as Any, "textos": textos])
        if continuo {
            session.alertMessage = "Lido ✓ — aproxime o próximo crachá"
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) { session.restartPolling() }
        } else {
            session.alertMessage = "Crachá lido ✓"
            session.invalidate()
        }
    }

    private func gravar(session: NFCTagReaderSession, ndef: NFCNDEFTag?, url: String, serial: String?, call: CAPPluginCall) {
        guard let ndef = ndef, let registro = NFCNDEFPayload.wellKnownTypeURIPayload(string: url) else {
            session.invalidate(errorMessage: "Este crachá não aceita gravação.")
            return
        }
        ndef.queryNDEFStatus { status, _, erro in
            guard erro == nil, status == .readWrite else {
                session.invalidate(errorMessage: status == .readOnly ? "Crachá protegido contra gravação." : "Crachá sem formato NDEF.")
                return
            }
            ndef.writeNDEF(NFCNDEFMessage(records: [registro])) { erro in
                if let erro = erro {
                    session.invalidate(errorMessage: "Falhou: \(erro.localizedDescription)")
                    return
                }
                session.alertMessage = "Link gravado ✓"
                session.invalidate()
                call.resolve(["serial": serial as Any])
                self.gravacao = nil
            }
        }
    }
}
