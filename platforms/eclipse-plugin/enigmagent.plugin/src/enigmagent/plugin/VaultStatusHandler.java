package enigmagent.plugin;

import org.eclipse.core.commands.AbstractHandler;
import org.eclipse.core.commands.ExecutionEvent;
import org.eclipse.core.commands.ExecutionException;
import org.eclipse.jface.dialogs.MessageDialog;
import org.eclipse.ui.handlers.HandlerUtil;

/**
 * Command handler: check vault status and display a dialog.
 */
public class VaultStatusHandler extends AbstractHandler {

    @Override
    public Object execute(ExecutionEvent event) throws ExecutionException {
        PreferenceInitializer prefs = new PreferenceInitializer();
        String host = Activator.getDefault().getPreferenceStore().getString("vaultHost");
        int    port = Activator.getDefault().getPreferenceStore().getInt("vaultPort");
        if (host == null || host.isBlank()) host = "127.0.0.1";
        if (port == 0) port = 3737;

        VaultClient client = new VaultClient(host, port);
        String title, message;
        int type;

        if (client.isUnlocked()) {
            title   = "EnigmAgent — Vault OK";
            message = "Vault is RUNNING and UNLOCKED.\n{{PLACEHOLDER}} references will resolve at runtime.";
            type    = MessageDialog.INFORMATION;
        } else if (client.isRunning()) {
            title   = "EnigmAgent — Vault Locked";
            message = "Vault is running but LOCKED.\nRestart enigmagent-mcp to unlock.";
            type    = MessageDialog.WARNING;
        } else {
            title   = "EnigmAgent — Vault Not Found";
            message = "Vault server is NOT running on " + host + ":" + port + ".\n\n"
                    + "Start it with:\n  enigmagent-mcp --mode rest --port " + port;
            type    = MessageDialog.ERROR;
        }

        final String fTitle = title;
        final String fMsg   = message;
        HandlerUtil.getActiveShell(event).getDisplay().asyncExec(() ->
            MessageDialog.open(type, HandlerUtil.getActiveShell(event), fTitle, fMsg, 0)
        );
        return null;
    }
}
