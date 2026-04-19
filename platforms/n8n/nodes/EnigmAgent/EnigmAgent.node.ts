import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IDataObject,
	NodeOperationError,
} from 'n8n-workflow';

export class EnigmAgent implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'EnigmAgent Vault',
		name: 'enigmAgent',
		icon: 'file:enigmagent.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Interact with the EnigmAgent local secret vault — check status, list secrets, and resolve {{PLACEHOLDER}} references securely.',
		defaults: {
			name: 'EnigmAgent Vault',
			color: '#6c47ff',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [],
		properties: [
			{
				displayName: 'Vault Host',
				name: 'vaultHost',
				type: 'string',
				default: '127.0.0.1',
				description: 'Hostname of the EnigmAgent vault REST server.',
			},
			{
				displayName: 'Vault Port',
				name: 'vaultPort',
				type: 'number',
				default: 3737,
				description: 'Port of the EnigmAgent vault REST server.',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Get Status',
						value: 'getStatus',
						description: 'Check if the vault is running and unlocked',
						action: 'Check vault status',
					},
					{
						name: 'List Secrets',
						value: 'listSecrets',
						description: 'List all secret names and domains (never values)',
						action: 'List vault secrets',
					},
					{
						name: 'Resolve Placeholder',
						value: 'resolvePlaceholder',
						description: 'Resolve a {{PLACEHOLDER}} to its real value',
						action: 'Resolve a placeholder',
					},
					{
						name: 'Resolve Text',
						value: 'resolveText',
						description: 'Replace all {{PLACEHOLDER}} references in a text block',
						action: 'Resolve all placeholders in text',
					},
				],
				default: 'getStatus',
			},
			// ── Resolve Placeholder ──────────────────────────────────────────────
			{
				displayName: 'Placeholder Name',
				name: 'placeholder',
				type: 'string',
				default: '',
				placeholder: 'GITHUB_TOKEN',
				description: 'The secret name to resolve — without braces. E.g. GITHUB_TOKEN.',
				displayOptions: {
					show: { operation: ['resolvePlaceholder'] },
				},
				required: true,
			},
			// ── Resolve Text ─────────────────────────────────────────────────────
			{
				displayName: 'Input Text',
				name: 'inputText',
				type: 'string',
				typeOptions: { rows: 6 },
				default: '',
				placeholder: 'Bearer {{GITHUB_TOKEN}}',
				description: 'Text containing one or more {{PLACEHOLDER}} references to replace.',
				displayOptions: {
					show: { operation: ['resolveText'] },
				},
				required: true,
			},
			// ── Shared: Origin ───────────────────────────────────────────────────
			{
				displayName: 'Origin',
				name: 'origin',
				type: 'string',
				default: 'http://localhost',
				description: 'Origin sent with resolve requests (for domain binding).',
				displayOptions: {
					show: { operation: ['resolvePlaceholder', 'resolveText'] },
				},
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const host      = this.getNodeParameter('vaultHost', 0, '127.0.0.1') as string;
		const port      = this.getNodeParameter('vaultPort', 0, 3737) as number;
		const operation = this.getNodeParameter('operation', 0) as string;
		const baseUrl   = `http://${host}:${port}`;

		for (let i = 0; i < items.length; i++) {
			try {
				let output: IDataObject = {};

				if (operation === 'getStatus') {
					const response = await this.helpers.httpRequest({
						method: 'GET',
						url: `${baseUrl}/status`,
					});
					output = {
						running:  true,
						unlocked: Boolean(response.unlocked),
						message:  response.unlocked
							? 'Vault RUNNING and UNLOCKED. {{PLACEHOLDER}} references will resolve.'
							: 'Vault LOCKED — restart: enigmagent-mcp --mode rest --port 3737',
					};

				} else if (operation === 'listSecrets') {
					const response = await this.helpers.httpRequest({
						method: 'GET',
						url: `${baseUrl}/list`,
					});
					const entries = (response.entries as Array<{ id: string; name: string; domain?: string }>) || [];
					output = {
						count:   entries.length,
						entries: entries.map((e) => ({ name: e.name, domain: e.domain ?? null })),
					};

				} else if (operation === 'resolvePlaceholder') {
					const placeholder = this.getNodeParameter('placeholder', i) as string;
					const origin      = this.getNodeParameter('origin', i, 'http://localhost') as string;

					const response = await this.helpers.httpRequest({
						method: 'POST',
						url:    `${baseUrl}/resolve`,
						headers: { 'Content-Type': 'application/json' },
						body:   { placeholder, origin },
					});

					output = {
						placeholder,
						value: response.value as string,
					};

				} else if (operation === 'resolveText') {
					const inputText = this.getNodeParameter('inputText', i) as string;
					const origin    = this.getNodeParameter('origin', i, 'http://localhost') as string;

					// Extract all {{PLACEHOLDER}} references from text
					const PLACEHOLDER_RE = /\{\{([A-Za-z0-9_:\-.@]+)\}\}/g;
					const matches = [...new Set([...inputText.matchAll(PLACEHOLDER_RE)].map((m) => m[1]))];

					let resolvedText = inputText;
					const resolutions: Record<string, string> = {};

					// Resolve each unique placeholder
					for (const name of matches) {
						const response = await this.helpers.httpRequest({
							method:  'POST',
							url:     `${baseUrl}/resolve`,
							headers: { 'Content-Type': 'application/json' },
							body:    { placeholder: name, origin },
						});
						const value = response.value as string;
						resolutions[name] = value;
						resolvedText = resolvedText.replace(
							new RegExp(`\\{\\{${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\}\\}`, 'g'),
							value,
						);
					}

					output = {
						original:  inputText,
						resolved:  resolvedText,
						replaced:  Object.keys(resolutions).length,
					};
				} else {
					throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`);
				}

				returnData.push({ json: output, pairedItem: { item: i } });
			} catch (error: unknown) {
				if (this.continueOnFail()) {
					const errorMessage = error instanceof Error ? error.message : String(error);
					returnData.push({
						json:       { error: errorMessage },
						pairedItem: { item: i },
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}
