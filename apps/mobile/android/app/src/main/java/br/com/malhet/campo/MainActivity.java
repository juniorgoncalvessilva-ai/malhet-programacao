package br.com.malhet.campo;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NfcCrachaPlugin.class); // spec 085: crachá NFC (a WebView não tem Web NFC)
        super.onCreate(savedInstanceState);
    }
}
