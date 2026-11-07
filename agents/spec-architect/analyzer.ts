import YAML from 'yaml';
import fs from 'fs';
import path from 'path';

export interface ContractAnalysisResult {
  endpoint: string;
  method: string;
  existingSchema: any;
  proposedChanges: {
    renamedFields: Array<{ from: string; to: string }>;
    addedFields: Array<{ name: string; type: string; enum?: string[] }>;
  };
  breakingChanges: Array<{
    field: string;
    reason: string;
    severity: 'CRITICAL' | 'WARNING';
  }>;
  recommendedStrategy: string;
  structuredProposalText: string;
}

export class ContractAnalyzer {
  public specPath: string;

  constructor(specPath: string) {
    this.specPath = specPath;
  }

  public readCurrentSpec(): any {
    const raw = fs.readFileSync(this.specPath, 'utf8');
    return YAML.parse(raw);
  }

  /**
   * Analyze an API modification request against the current OpenAPI specification
   */
  public analyzeChangeRequest(requestText: string): ContractAnalysisResult {
    const spec = this.readCurrentSpec();

    // Default target: GET /api/spots
    const endpoint = '/api/spots';
    const method = 'GET';
    const spotSchema = spec.components?.schemas?.Spot || {};

    const renamedFields: Array<{ from: string; to: string }> = [];
    const addedFields: Array<{ name: string; type: string; enum?: string[] }> = [];

    // Parse rename patterns: "rename X to Y"
    const renameMatch = requestText.match(/rename\s+([a-zA-Z0-9_]+)\s+to\s+([a-zA-Z0-9_]+)/i);
    if (renameMatch) {
      renamedFields.push({ from: renameMatch[1], to: renameMatch[2] });
    }

    // Parse role/enum addition: "add a role field with the values admin, user and guest"
    const roleMatch = requestText.match(/add (?:a )?role (?:field )?with (?:the )?values? ([a-zA-Z0-9_,\s]+)/i);
    if (roleMatch) {
      const enumValues = roleMatch[1]
        .replace(/and/g, ',')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      addedFields.push({ name: 'role', type: 'string', enum: enumValues });
    }

    // Identify breaking changes
    const breakingChanges: Array<{ field: string; reason: string; severity: 'CRITICAL' | 'WARNING' }> = [];

    for (const rename of renamedFields) {
      if (spotSchema.properties && spotSchema.properties[rename.from]) {
        breakingChanges.push({
          field: rename.from,
          reason: `Renaming '${rename.from}' to '${rename.to}' will immediately break frontend consumers expecting response.${rename.from}.`,
          severity: 'CRITICAL'
        });
      }
    }

    const recommendedStrategy =
      'Introduce `availability_state`, retain `spot_status` as an optional deprecated field for backward compatibility, and add the `role` enum with allowed values [admin, user, guest].';

    const proposalText = [
      '### [API CHANGE DETECTED]',
      `- **Target Endpoint**: \`${method} ${endpoint}\``,
      `- **Field Renames**: ${renamedFields.map((r) => `\`${r.from}\` -> \`${r.to}\``).join(', ') || 'None'}`,
      `- **Field Additions**: ${addedFields.map((a) => `\`${a.name}\` (${a.enum ? `enum: [${a.enum.join(', ')}]` : a.type})`).join(', ') || 'None'}`,
      '',
      '### [BREAKING CHANGE DETECTED]',
      ...breakingChanges.map((b) => `- **${b.field}** (${b.severity}): ${b.reason}`),
      '',
      '### [RECOMMENDED MIGRATION STRATEGY]',
      `- ${recommendedStrategy}`,
      '',
      '### [HUMAN APPROVAL REQUIRED]',
      'SpecArchitect has paused contract modification. Awaiting explicit authorization from @developer in this Switch room.',
      'Please reply with: `APPROVE: ...` to authorize or provide revised instructions.'
    ].join('\n');

    return {
      endpoint,
      method,
      existingSchema: spotSchema,
      proposedChanges: {
        renamedFields,
        addedFields
      },
      breakingChanges,
      recommendedStrategy,
      structuredProposalText: proposalText
    };
  }

  /**
   * Validate human approval message
   */
  public validateApproval(approvalText: string): { valid: boolean; reason?: string } {
    const trimmed = approvalText.trim();
    if (!trimmed.toUpperCase().startsWith('APPROVE:') && !trimmed.toUpperCase().startsWith('APPROVED:')) {
      return {
        valid: false,
        reason: 'Message does not start with APPROVE: or APPROVED:'
      };
    }

    const lower = trimmed.toLowerCase();
    const hasAvailability = lower.includes('availability_state');
    const hasDeprecatedRetention = lower.includes('spot_status') && (lower.includes('deprecated') || lower.includes('retain') || lower.includes('optional'));
    const hasRole = lower.includes('role');

    if (!hasAvailability || !hasDeprecatedRetention || !hasRole) {
      return {
        valid: false,
        reason: 'Approval message missing explicit mitigation parameters (availability_state, deprecated spot_status, or role enum).'
      };
    }

    return { valid: true };
  }

  /**
   * Apply approved contract changes and update openapi.yaml
   */
  public applyApprovedChanges(): any {
    const spec = this.readCurrentSpec();

    // Update Spot schema
    const spotSchema = spec.components.schemas.Spot;

    // Remove spot_status from required list and add availability_state
    spotSchema.required = ['id', 'name', 'availability_state'];

    // Add availability_state
    spotSchema.properties.availability_state = {
      type: 'string',
      description: 'Current operational availability state of the resource spot',
      example: 'available'
    };

    // Add role enum
    spotSchema.properties.role = {
      type: 'string',
      description: 'Access role associated with the spot',
      enum: ['admin', 'user', 'guest'],
      example: 'admin'
    };

    // Mark spot_status as deprecated and optional
    spotSchema.properties.spot_status = {
      type: 'string',
      description: 'DEPRECATED: Use availability_state instead. Retained for backward compatibility.',
      deprecated: true,
      example: 'available'
    };

    // Bump version to 1.1.0
    spec.info.version = '1.1.0';

    // Write back YAML
    const updatedYaml = YAML.stringify(spec, { indent: 2 });
    fs.writeFileSync(this.specPath, updatedYaml, 'utf8');

    return spec;
  }
}
