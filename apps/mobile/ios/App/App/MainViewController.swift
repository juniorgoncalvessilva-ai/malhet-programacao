import Capacitor
import UIKit

/// Registra os plugins nativos do próprio app (spec 085) — hoje o leitor de crachá NFC.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(NfcCrachaPlugin())
    }
}
