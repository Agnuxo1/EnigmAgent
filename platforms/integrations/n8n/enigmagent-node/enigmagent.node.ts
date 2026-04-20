/**
 * EnigmAgent Node for n8n
 * ========================
 * Adds an "EnigmAgent: Resolve Secrets" node to n8n that resolves
 * {{PLACEHOLDER}} tokens in any input text using the local vault.
 *
 * Install:
 *   npm install  (in this directory)
 *   Copy/symlink this directory to ~/.n8n/custom/ or use n8n community nodes
 *
 * Or submit to the n8n community nodes registry as n8n-nodes-enigmagent
 * (already published — add via Settings > Community Nodes > Install)
 */

import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from "n8n-workflow";

export class EnigmAgent implements INodeType {
  description: INodeTypeDescription = {
    displayName: "EnigmAgent Vault",
    name: "enigmAgent",
    icon: "file:enigmagent.svg",
    group: ["transform"],
    version: 1,
    description:
      "Resolve {{PLACEHOLDER}} tokens or retrieve secrets from the local EnigmAgent AES-256-GCM vault.",
    defaults: {
      name: "EnigmAgent Vault",
    },
    inputs: ["main"],
    outputs: ["main"],
    credentials: [
      {
        name: "enigmAgentApi",
        required: false,
      },
    ],
    properties: [
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        options: [
          {
            name: "Resolve Placeholders",
            value: "resolve",
            description: "Replace {{PLACEHOLDER}} tokens in text with vault values",
            action: "Resolve placeholder tokens in text",
          },
          {
            name: "Get Secret",
            value: "getSecret",
            description: "Retrieve a single secret value by name",
            action: "Get a secret by name",
          },
          {
            name: "List Secrets",
            value: "listSecrets",
            description: "List all stored secret names (no values)",
            action: "List all stored secret names",
          },
        ],
        default: "resolve",
      },
      {
        displayName: "Input Text",
        name: "inputText",
        type: "string",
        typeOptions: { rows: 4 },
        default: "",
        placeholder: "Text with {{PLACEHOLDER}} tokens...",
        description: "Text containing {{SECRET_NAME}} tokens to resolve",
        displayOptions: { show: { operation: ["resolve"] } },
        required: true,
      },
      {
        displayName: "Secret Name",
        name: "secretName",
        type: "string",
        default: "",
        placeholder: "OPENAI_KEY",
        description: "Name of the secret to retrieve",
        displayOptions: { show: { operation: ["getSecret"] } },
        required: true,
      },
      {
        displayName: "Vault URL",
        name: "vaultUrl",
        type: "string",
        default: "http://127.0.0.1:39517",
        description: "EnigmAgent vault REST API URL (overrides credentials)",
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const operation = this.getNodeParameter("operation", 0) as string;
    const vaultUrl = (this.getNodeParameter("vaultUrl", 0) as string).replace(/\/$/, "");

    const headers: Record<string, string> = { Accept: "application/json" };
    // Try credentials
    try {
      const creds = await this.getCredentials("enigmAgentApi");
      if (creds?.token) headers["Authorization"] = `Bearer ${creds.token}`;
    } catch {}

    const results: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      try {
        if (operation === "getSecret") {
          const name = this.getNodeParameter("secretName", i) as string;
          const res = await this.helpers.request({
            method: "GET",
            url: `${vaultUrl}/secret/${encodeURIComponent(name)}`,
            headers,
            json: true,
          });
          results.push({ json: { name, value: res.value } });

        } else if (operation === "listSecrets") {
          const res = await this.helpers.request({
            method: "GET",
            url: `${vaultUrl}/secrets`,
            headers,
            json: true,
          });
          results.push({ json: { secrets: res.secrets ?? [] } });

        } else {
          // resolve
          let text = this.getNodeParameter("inputText", i) as string;
          const names = [...new Set((text.match(/\{\{([A-Za-z0-9_]+)\}\}/g) || []).map((m) => m.slice(2, -2)))];

          const map: Record<string, string> = {};
          for (const name of names) {
            try {
              const res = await this.helpers.request({
                method: "GET",
                url: `${vaultUrl}/secret/${encodeURIComponent(name)}`,
                headers,
                json: true,
              });
              if (res.value) map[name] = res.value;
            } catch {}
          }

          const resolved = text.replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (_, n) => map[n] ?? `{{${n}}}`);
          results.push({ json: { resolved, resolvedCount: Object.keys(map).length } });
        }
      } catch (e: any) {
        if (this.continueOnFail()) {
          results.push({ json: { error: e.message }, pairedItem: { item: i } });
        } else {
          throw new NodeOperationError(this.getNode(), e, { itemIndex: i });
        }
      }
    }

    return [results];
  }
}
