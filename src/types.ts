export interface Bin {
  bin_id: string;
  waste_type: 'Plastic' | 'Metal' | 'Paper' | 'Organic' | 'Residual';
  fill_level: number; // 0 to 100
  status: 'Empty' | 'Normal' | 'Almost Full' | 'Full';
  location: string;
  capacity_kg: number;
  last_updated: string;
}

export interface Notification {
  notification_id: string;
  message: string;
  timestamp: string;
  bin_id?: string;
  assigned_to?: string;
  status: 'Unresolved' | 'Acknowledged' | 'Resolved';
  priority: 'Low' | 'Medium' | 'High';
}

export interface WasteLog {
  id: string;
  timestamp: string;
  waste_type: 'Plastic' | 'Metal' | 'Paper' | 'Organic' | 'Residual';
  confidence: number;
  image_url?: string;
  instruction: string;
  weight_g: number;
}

export interface Collector {
  id: string;
  name: string;
  status: 'Idle' | 'En Route' | 'Busy';
  contact: string;
  vehicle_no: string;
}

export interface ModelPrediction {
  class: 'Plastic' | 'Metal' | 'Paper' | 'Organic' | 'Residual';
  confidence: number;
  segregation_instruction: string;
  fun_recycling_fact?: string;
}
