/**
 * EnigmAgent Placeholder Resolver Node for Flowise
 * ==================================================
 * Chain this node before any LLM or chain node to resolve all
 * {{PLACEHOLDER}} tokens in a string input using the local vault.
 *
 * Install: same as EnigmAgentTool.ts — copy to nodes/tools/EnigmAgent/
 */

import { INode, INodeData, INodeParams } from "../../../src/Interface";

class EnigmAgentResolverNode implements INode {
  label: string;
  name: string;
  version: number;
  type: string;
  icon: string;
  category: string;
  description: string;
  baseClasses: string[];
  inputs: INodeParams[];
  outputs: any[];

  constructor() {
    this.label = "EnigmAgent Resolver";
    this.name = "enigmagentResolver";
    this.version = 1.0;
    this.type = "EnigmAgentResolver";
    this.icon = "enigmagent.svg";
    this.category = "Utilities";
    this.description =
      "Resolves all {{PLACEHOLDER}} tokens in the input string by fetching values from the local EnigmAgent vault.";
    this.baseClasses = [this.type];
    this.inputs = [
      {
        label: "Input Text",
        name: "inputText",
        type: "string",
        description: "Text containing {{PLACEHOLDER}} tokens to resolve.",
      },
      {
        label: "Vault URL",
        name: "vaultUrl",
        type: "string",
        default: "http://127.0.0.1:39517",
        optional: true,
      },
      {
        label: "Vault Token",
        name: "vaultToken",
        type: "password",
        optional: true,
      },
    ];
    this.outputs = [
      {
        label: "Resolved Text",
        name: "resolvedText",
        baseClasses: ["string"],
      },
    ];
  }

  async init(nodeData: INodeData): Promise<string> {
    const text = (nodeData.inputs?.inputText as string) || "";
    const vaultUrl = ((nodeData.inputs?.vaultUrl as string) || "http://127.0.0.1:39517").replace(/\/$/, "");
    const vaultToken = (nodeData.inputs?.vaultToken as string) || "";

    const names = [...new Set(text.match(/\{\{([A-Za-z0-9_]+)\}\}/g)?.map((m) => m.slice(2, -2)) ?? [])];
    if (!names.length) return text;

    const pairs = await Promise.all(
      names.map(async (name) => {
        const url = `${vaultUrl}/secret/${encodeURIComponent(name)}`;
        const headers: Record<string, string> = { Accept: "application/json" };
        if (vaultToken) headers["Authorization"] = `Bearer ${vaultToken}`;
        try {
          const res = await fetch(url, { headers, signal: AbortSignal.timeout(5000) });
          if (!res.ok) return [name, null];
          const data = await res.json();
          return [name, data?.value ?? null];
        } catch {
          return [name, null];
        }
      })
    );

    const map = Object.fromEntries(pairs.filter(([, v]) => v !== null));
    return text.replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (_, n) => map[n] ?? `{{${n}}}`);
  }
}

module.exports = { nodeClass: EnigmAgentResolverNode };
