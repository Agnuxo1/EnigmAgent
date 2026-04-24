package enigmagent.plugin;

import org.eclipse.jface.preference.FieldEditorPreferencePage;
import org.eclipse.jface.preference.IntegerFieldEditor;
import org.eclipse.jface.preference.StringFieldEditor;
import org.eclipse.ui.IWorkbench;
import org.eclipse.ui.IWorkbenchPreferencePage;

/**
 * Settings page: Window > Preferences > EnigmAgent Vault
 */
public class EnigmAgentPreferencePage extends FieldEditorPreferencePage
        implements IWorkbenchPreferencePage {

    public EnigmAgentPreferencePage() {
        super(GRID);
        setDescription("Configure the local EnigmAgent vault REST API connection.\n\n"
            + "Start the vault with: enigmagent-mcp --mode rest --port 3737");
    }

    @Override
    public void init(IWorkbench workbench) {
        setPreferenceStore(Activator.getDefault().getPreferenceStore());
    }

    @Override
    protected void createFieldEditors() {
        addField(new StringFieldEditor("vaultHost", "Vault &Host:", getFieldEditorParent()));
        addField(new IntegerFieldEditor("vaultPort", "Vault &Port:", getFieldEditorParent()));
        addField(new StringFieldEditor("vaultOrigin", "Vault &Origin:", getFieldEditorParent()));
    }
}
