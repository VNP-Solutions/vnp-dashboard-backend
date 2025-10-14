import { Note, Prisma } from '@prisma/client'
import { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import {
  CreateNoteDto,
  DeleteAllNotesDto,
  NoteQueryDto,
  UpdateNoteDto
} from './note.dto'

type NoteWithRelations = Prisma.NoteGetPayload<{
  include: {
    portfolio: {
      select: {
        id: true
        name: true
      }
    }
    property: {
      select: {
        id: true
        name: true
      }
    }
  }
}>

export interface INoteRepository {
  create(data: CreateNoteDto): Promise<NoteWithRelations>
  findAll(queryOptions: any): Promise<NoteWithRelations[]>
  findById(id: string): Promise<NoteWithRelations | null>
  update(id: string, data: UpdateNoteDto): Promise<NoteWithRelations>
  delete(id: string): Promise<Note>
  deleteMany(whereClause: any): Promise<number>
}

export interface INoteService {
  create(
    data: CreateNoteDto,
    user: IUserWithPermissions
  ): Promise<NoteWithRelations>
  findAll(
    query: NoteQueryDto,
    user: IUserWithPermissions
  ): Promise<NoteWithRelations[]>
  findOne(id: string, user: IUserWithPermissions): Promise<NoteWithRelations>
  update(
    id: string,
    data: UpdateNoteDto,
    user: IUserWithPermissions
  ): Promise<NoteWithRelations>
  remove(id: string, user: IUserWithPermissions): Promise<{ message: string }>
  removeAll(
    query: DeleteAllNotesDto,
    user: IUserWithPermissions
  ): Promise<{ message: string; deletedCount: number }>
}
