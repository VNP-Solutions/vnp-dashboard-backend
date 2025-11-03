import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import {
  CreateNoteDto,
  DeleteAllNotesDto,
  NoteQueryDto,
  UpdateNoteDto
} from './note.dto'
import type { INoteRepository, INoteService } from './note.interface'

@Injectable()
export class NoteService implements INoteService {
  constructor(
    @Inject('INoteRepository')
    private noteRepository: INoteRepository
  ) {}

  async create(data: CreateNoteDto, user: IUserWithPermissions) {
    if (!data.portfolio_id && !data.property_id) {
      throw new BadRequestException(
        'Note must be associated with either a portfolio or property'
      )
    }

    return this.noteRepository.create({
      ...data,
      user_id: user.id
    })
  }

  async findAll(query: NoteQueryDto, user: IUserWithPermissions) {
    // Build where clause - always filter by user_id
    const where: any = {
      user_id: user.id
    }

    // Add portfolio filter if provided
    if (query.portfolio_id) {
      where.portfolio_id = query.portfolio_id
    }

    // Add property filter if provided
    if (query.property_id) {
      where.property_id = query.property_id
    }

    // Filter by is_done
    if (query.is_done !== undefined && query.is_done !== '') {
      where.is_done = query.is_done === 'true'
    }

    // Search by text, portfolio name, and property name
    if (query.search) {
      where.OR = [
        {
          text: {
            contains: query.search,
            mode: 'insensitive'
          }
        },
        {
          portfolio: {
            name: {
              contains: query.search,
              mode: 'insensitive'
            }
          }
        },
        {
          property: {
            name: {
              contains: query.search,
              mode: 'insensitive'
            }
          }
        }
      ]
    }

    // Build orderBy - only sort by created_at
    const orderBy = {
      created_at: query.sortOrder === 'asc' ? 'asc' : 'desc'
    }

    const data = await this.noteRepository.findAll({ where, orderBy })

    return data
  }

  async findOne(id: string, user: IUserWithPermissions) {
    const note = await this.noteRepository.findById(id)

    if (!note) {
      throw new NotFoundException('Note not found')
    }

    // Ensure the note belongs to the authenticated user
    if (note.user_id !== user.id) {
      throw new ForbiddenException('You do not have access to this note')
    }

    return note
  }

  async update(id: string, data: UpdateNoteDto, user: IUserWithPermissions) {
    const note = await this.noteRepository.findById(id)

    if (!note) {
      throw new NotFoundException('Note not found')
    }

    // Ensure the note belongs to the authenticated user
    if (note.user_id !== user.id) {
      throw new ForbiddenException('You do not have access to this note')
    }

    return this.noteRepository.update(id, data)
  }

  async remove(id: string, user: IUserWithPermissions) {
    const note = await this.noteRepository.findById(id)

    if (!note) {
      throw new NotFoundException('Note not found')
    }

    // Ensure the note belongs to the authenticated user
    if (note.user_id !== user.id) {
      throw new ForbiddenException('You do not have access to this note')
    }

    await this.noteRepository.delete(id)

    return { message: 'Note deleted successfully' }
  }

  async removeAll(query: DeleteAllNotesDto, user: IUserWithPermissions) {
    // Build where clause - always filter by user_id
    const where: any = {
      user_id: user.id
    }

    // Ensure at least one filter is provided
    if (
      !query.portfolio_id &&
      !query.property_id &&
      query.is_done === undefined
    ) {
      throw new BadRequestException(
        'At least one filter (portfolio_id, property_id, or is_done) must be provided'
      )
    }

    // Build filter based on query
    if (query.portfolio_id) {
      where.portfolio_id = query.portfolio_id
    }

    if (query.property_id) {
      where.property_id = query.property_id
    }

    // Filter by is_done
    if (query.is_done !== undefined && query.is_done !== '') {
      where.is_done = query.is_done === 'true'
    }

    const deletedCount = await this.noteRepository.deleteMany(where)

    return {
      message: `${deletedCount} note(s) deleted successfully`,
      deletedCount
    }
  }
}
