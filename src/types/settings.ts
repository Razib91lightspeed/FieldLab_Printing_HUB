export interface PrinterConfigItem {
  id: string;
  name: string;
  ip: string;
  access_code: string;
  serial: string;
  enabled: boolean;

  is_pipeline_healthy?: boolean;
  needs_verification?: boolean;
  health_message?: string;

  last_seen?: string;
  last_updated?: string;
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