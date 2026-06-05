export type PrinterHealthCode =
  | 'MQTT_OK'
  | 'MQTT_AUTH_FAILED'
  | 'MQTT_CHECK_FAILED'
  | 'ACCESS_CODE_INVALID'
  | 'AUTH_FAILED'
  | 'UNAUTHORIZED'
  | 'VALIDATOR_EXCEPTION'
  | 'VALIDATOR_COMMAND_FAILED'
  | 'VALIDATOR_BAD_OUTPUT'
  | 'VALIDATOR_SCRIPT_MISSING'
  | 'VALIDATOR_PYTHON_MISSING'
  | 'PRINTER_DISABLED'
  | 'VALIDATION_DISABLED'
  | null;
export interface PrinterConfigItem {
  id: string;
  name: string;
  ip: string;
  access_code: string;
  serial: string;
  enabled: boolean;

  is_pipeline_healthy?: boolean;

  health_code?: PrinterHealthCode;
  health_message?: string | null;

  last_error?: string | null;
  last_error_at?: string | null;
  last_seen?: string | null;
  last_updated?: string | null;

  access_validation_at?: string | null;
  mqtt_validation_reason?: string | null;
}


export interface PrinterConfigResponse {
  last_updated?: string;
  fiware_endpoint?: string;
  printers: PrinterConfigItem[];
}

export interface NgsiValue<T = any> {
  type?: string;
  value?: T;
  observedAt?: string;
  modifiedAt?: string;
  createdAt?: string;
}

export interface LivePrinterItem {
  id: string;
  type?: string;

  name?: NgsiValue<string> | string;
  status?: NgsiValue<string> | string;
  online?: NgsiValue<boolean | string> | boolean | string;
  lastSeen?: NgsiValue<string> | string;
  last_seen?: NgsiValue<string> | string;

  progress?: NgsiValue<number> | number;
  jobName?: NgsiValue<string> | string;
  nozzleTemp?: NgsiValue<number> | number;
  bedTemp?: NgsiValue<number> | number;
  material?: NgsiValue<string> | string;
  color?: NgsiValue<string> | string;

  dateModified?: NgsiValue<string> | string;
  modifiedAt?: string;

  [key: string]: any;
}

export interface LivePrinterState {
  id?: string;
  name?: string;
  status?: string;
  online?: boolean;
  lastSeen?: string;
  telemetryUpdatedAt?: string;
}

export interface PrinterStatusState {
  label: string;
  color: string;
  isWarning: boolean;
  description: string;
}