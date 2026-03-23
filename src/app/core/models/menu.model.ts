export interface MenuItem {
  name: string;
  price: number;
  popular?: boolean;
  desc?: string;
}

export interface Store {
  id: string;
  name: string;
  badge: string;
  address: string;
  hours: string;
  phone?: string;
  website?: string;
  menu: Record<string, MenuItem[]>;
}

export interface CartItem {
  storeId: string;
  storeName: string;
  name: string;
  price: number;
  qty: number;
  note?: string;
}
