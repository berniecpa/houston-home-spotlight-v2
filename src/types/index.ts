export interface Listing {
  id: string;
  slug: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  price: number;
  beds: number;
  baths: number;
  sqft: number;
  description: string;
  images: string[];
  videoUrl?: string;
  featured: boolean;
  status: 'active' | 'pending' | 'sold';
  createdAt: string;
  updatedAt: string;
}

export interface LeadFormData {
  firstname: string;
  lastname: string;
  email: string;
  phonenumber: string;
  description: string;
  listingId?: string;
}
