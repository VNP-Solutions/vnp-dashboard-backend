export interface IPortfolio {
  id: string
  name: string
  service_type_id: string
  is_contract_signed: boolean
  contract_url?: string | null
  is_active: boolean
  contact_email?: string | null
  is_commissionable: boolean
  created_at: Date
  updated_at: Date
}

export interface IPortfolioWithRelations extends IPortfolio {
  serviceType: {
    id: string
    type: string
    is_active: boolean
  }
  properties?: Array<{
    id: string
    name: string
    is_active: boolean
  }>
}
