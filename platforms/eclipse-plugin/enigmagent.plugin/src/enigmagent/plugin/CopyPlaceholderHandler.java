package enigmagent.plugin;

import java.util.List;

import org.eclipse.core.commands.AbstractHandler;
import org.eclipse.core.commands.ExecutionEvent;
import org.eclipse.core.commands.ExecutionException;
import org.eclipse.jface.dialogs.MessageDialog;
import org.eclipse.jface.window.Window;
import org.eclipse.swt.dnd.Clipboard;
import org.eclipse.swt.dnd.TextTransfer;
import org.eclipse.swt.dnd.Transfer;
import org.eclipse.swt.widgets.Display;
import org.eclipse.swt.widgets.Shell;
import org.eclipse.ui.dialogs.ElementListSelectionDialog;
import org.eclipse.jface.viewers.LabelProvider;
import org.eclipse.ui.handlers.HandlerUtil;

/**
 * Command handler: show a picker of vault secret names and copy the chosen
 * {{PLACEHOLDER}} to the system clipboard.
 */
public class CopyPlaceholderHandler extends AbstractHandler {

    @Override
    public Object execute(ExecutionEvent event) throws ExecutionException {
        Shell shell = HandlerUtil.getActiveShell(event);
        if (shell == null) return null;

        String host = Activator.getDefault().getPreferenceStore().getString("vaultHost");
        int    port = Activator.getDefault().getPreferenceStore().getInt("vaultPort");
        if (host == null || host.isBlank()) host = "127.0.0.1";
        if (port == 0) port = 3737;

        VaultClient client = new VaultClient(host, port);

        List<String> names;
        try {
            names = client.listSecretNames();
        } catch (Exception ex) {
            MessageDialog.openError(shell, "EnigmAgent",
                "Cannot reach vault at " + host + ":" + port + "\n\n"
                + "Start the vault with:\n  enigmagent-mcp --mode rest --port " + port);
            return null;
        }

        if (names.isEmpty()) {
            MessageDialog.openInformation(shell, "EnigmAgent",
                "Vault is empty — add a secret first:\n  enigmagent add MY_KEY @localhost value");
            return null;
        }

        // Build placeholder strings for display
        String[] items = names.stream()
            .map(n -> "{{" + n + "}}")
            .toArray(String[]::new);

        ElementListSelectionDialog dialog = new ElementListSelectionDialog(shell, new LabelProvider());
        dialog.setTitle("Copy EnigmAgent Placeholder");
        dialog.setMessage("Select a secret (copies {{NAME}} to clipboard):");
        dialog.setElements(items);
        dialog.setMultipleSelection(false);

        if (dialog.open() == Window.OK && dialog.getFirstResult() instanceof String chosen) {
            Clipboard cb = new Clipboard(Display.getCurrent());
            cb.setContents(new Object[]{chosen}, new Transfer[]{TextTransfer.getInstance()});
            cb.dispose();
            MessageDialog.openInformation(shell, "EnigmAgent", "Copied  " + chosen + "  to clipboard.");
        }
        return null;
    }
}
