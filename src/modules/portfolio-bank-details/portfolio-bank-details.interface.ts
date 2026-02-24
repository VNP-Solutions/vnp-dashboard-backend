import {
  CreatePortfolioBankDetailsDto,
  UpdatePortfolioBankDetailsDto
} from './portfolio-bank-details.dto'

export interface IPortfolioBankDetailsRepository {
  create(data: any): Promise<any>
  findByPortfolioId(portfolioId: string): Promise<any>
  update(portfolioId: string, data: any): Promise<any>
  delete(portfolioId: string): Promise<any>
}

export interface IPortfolioBankDetailsService {
  create(data: CreatePortfolioBankDetailsDto, user: any, location?: string | null): Promise<any>
  findByPortfolioId(portfolioId: string, user: any): Promise<any>
  update(portfolioId: string, data: UpdatePortfolioBankDetailsDto, user: any, location?: string | null): Promise<any>
}
