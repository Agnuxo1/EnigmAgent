/**
 * EnigmAgent Custom Tool for Flowise
 * ====================================
 * Resolves {{PLACEHOLDER}} tokens using the local EnigmAgent vault.
 * Use this node in any Flowise chain to inject secrets at runtime.
 *
 * Install:
 *   1. Copy this file to packages/components/nodes/tools/EnigmAgent/
 *   2. Run `pnpm build` in the Flowise repo root.
 *   3. The "EnigmAgent Vault" node will appear in the Tools category.
 */

import { INode, INodeData, INodeOutputsValue, INodeParams } from "../../../src/Interface";
import { getBaseClasses } from "../../../src/utils";
import { Tool } from "langchain/tools";

class EnigmAgentVaultTool extends Tool {
  name = "enigmagent_vault";
  description =
    "Resolves a {{PLACEHOLDER}} token by looking up the secret name in the local EnigmAgent vault. " +
    "Input: the placeholder name (without braces). Output: the secret value.";

  private vaultUrl: string;
  private vaultToken: string;

  constructor(vaultUrl: string, vaultToken: string) {
    super();
    this.vaultUrl = vaultUrl.replace(/\/$/, "");
    this.vaultToken = vaultToken;
  }

  async _call(secretName: string): Promise<string> {
    const name = secretName.replace(/^\{\{|\}\}$/g, "").trim();
    const url = `${this.vaultUrl}/secret/${encodeURIComponent(name)}`;
    const headers: Record<string, string> = { Accept: "application/json" };
    if (this.vaultToken) headers["Authorization"] = `Bearer ${this.vaultToken}`;

    const res = await fetch(url, { headers, signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`EnigmAgent vault returned ${res.status} for secret "${name}"`);
    const data = await res.json();
    const value = data?.value;
    if (!value) throw new Error(`Secret "${name}" not found in vault`);
    return value;
  }
}

class EnigmAgentNode implements INode {
  label: string;
  name: string;
  version: number;
  type: string;
  icon: string;
  category: string;
  description: string;
  baseClasses: string[];
  inputs: INodeParams[];

  constructor() {
    this.label = "EnigmAgent Vault";
    this.name = "enigmagentVault";
    this.version = 1.0;
    this.type = "EnigmAgentVault";
    this.icon = "enigmagent.svg";
    this.category = "Tools";
    this.description =
      "Look up secrets from the local EnigmAgent AES-256-GCM encrypted vault. " +
      "Secrets are resolved at runtime — never stored in Flowise or sent in plaintext.";
    this.baseClasses = [this.type, ...getBaseClasses(Tool)];
    this.inputs = [
      {
        label: "Vault URL",
        name: "vaultUrl",
        type: "string",
        default: "http://127.0.0.1:39517",
        description: "Base URL of the EnigmAgent REST API.",
        optional: true,
      },
      {
        label: "Vault Token",
        name: "vaultToken",
        type: "password",
        description: "Bearer token (optional — leave empty for localhost).",
        optional: true,
      },
    ];
  }

  async init(nodeData: INodeData): Promise<any> {
    const vaultUrl = (nodeData.inputs?.vaultUrl as string) || "http://127.0.0.1:39517";
    const vaultToken = (nodeData.inputs?.vaultToken as string) || "";
    return new EnigmAgentVaultTool(vaultUrl, vaultToken);
  }
}

module.exports = { nodeClass: EnigmAgentNode };
