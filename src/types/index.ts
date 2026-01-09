// User and Auth types
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'colaborador';
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// App Settings types
export interface AppSettings {
  isConfigured: boolean;
  database: DatabaseConfig | null;
  smtp: SmtpConfig | null;
  preferences: AppPreferences | null;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export interface SmtpConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string;
}

export interface AppPreferences {
  companyName: string;
  logoUrl?: string;
  theme: 'light' | 'dark' | 'system';
  timezone: string;
  backendUrl?: string;
  emailNotifications?: boolean;
}

// Database Connection types
export interface DbConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  status: 'active' | 'inactive' | 'error';
}

// Template types
export interface ChecklistTemplate {
  id: string;
  name: string;
  description: string;
  version: string;
  expectedInputs: ExpectedInput[];
  sections: TemplateSection[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface ExpectedInput {
  key: string;
  label: string;
  type: 'number' | 'currency' | 'text';
  scope: 'global' | 'per_store';
  required: boolean;
  hint?: string;
}

export interface TemplateSection {
  id: string;
  key: string;
  title: string;
  order: number;
  items: TemplateItem[];
}

export interface TemplateItem {
  id: string;
  key: string;
  title: string;
  description: string;
  order: number;
  query: string;
  validationRule: ValidationRule;
  scope: 'global' | 'per_store';
  expectedInputBinding?: string;
  autoResolve: boolean;
}

export interface ValidationRule {
  type: 'single_number_required' | 'must_return_rows' | 'must_return_no_rows' | 'number_equals_expected' | 'number_matches_expected_with_tolerance';
  tolerance?: number;
}

// Conference types
export type ConferenceStatus = 'pending' | 'in_progress' | 'completed' | 'divergent';

export interface Conference {
  id: string;
  name: string;
  clientName: string;
  clientEmail: string;
  connectionId: string;
  templateId: string;
  status: ConferenceStatus;
  linkToken: string;
  linkExpiresAt: Date;
  stores: Store[];
  expectedInputValues: Record<string, ExpectedInputValue>;
  items: ConferenceItem[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  completedAt?: Date;
  completedBy?: string;
}

export interface Store {
  id: string;
  name: string;
  storeId: string;
}

export interface ExpectedInputValue {
  value: string | number;
  storeId?: string;
}

export type ItemStatus = 'pending' | 'auto_ok' | 'correct' | 'divergent' | 'warn' | 'fail';

export interface ConferenceItem {
  id: string;
  templateItemId: string;
  status: ItemStatus;
  queryResult?: unknown;
  userResponse?: 'correct' | 'divergent';
  observation?: string;
  attachments?: string[];
  executedAt?: Date;
  respondedAt?: Date;
  respondedBy?: string;
}

// Custom Layout types
export interface CustomLayout {
  id: string;
  entityType: 'template' | 'conference' | 'section';
  entityId: string;
  layoutJson: LayoutConfig;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface LayoutConfig {
  columns: number;
  fields: FieldLayout[];
  theme?: {
    spacing: 'compact' | 'normal' | 'relaxed';
    cardStyle: 'flat' | 'elevated' | 'bordered';
  };
}

export interface FieldLayout {
  fieldKey: string;
  column: number;
  row: number;
  width: number;
  height: number;
  visible: boolean;
  icon?: string;
  color?: string;
  groupId?: string;
  helpText?: string;
}

// Custom Query types
export type QueryCategory = 'validation' | 'integration' | 'listing';

export interface CustomQuery {
  id: string;
  name: string;
  description: string;
  category: QueryCategory;
  sql: string;
  params: QueryParam[];
  connectionId?: string;
  outputFormat: 'table' | 'number' | 'list';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface QueryParam {
  name: string;
  type: 'string' | 'number' | 'date';
  required: boolean;
  defaultValue?: string;
}

// Audit types
export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  userId: string;
  userName: string;
  details: Record<string, unknown>;
  ipAddress?: string;
  createdAt: Date;
}
