import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags
} from '@nestjs/swagger'
import { PermissionGuard } from '../../common/guards/permission.guard'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import {
  CreateNoteDto,
  DeleteAllNotesDto,
  NoteQueryDto,
  UpdateNoteDto
} from './note.dto'
import type { INoteService } from './note.interface'

@ApiTags('Note')
@ApiBearerAuth('JWT-auth')
@Controller('note')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class NoteController {
  constructor(
    @Inject('INoteService')
    private readonly noteService: INoteService
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new note' })
  @ApiResponse({ status: 201, description: 'Note created successfully' })
  @ApiResponse({
    status: 400,
    description: 'Note must be associated with either a portfolio, property, or audit'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  create(
    @Body() createNoteDto: CreateNoteDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.noteService.create(createNoteDto, user)
  }

  @Get()
  @ApiOperation({
    summary: 'Get all notes with search, filter, and sort (no pagination)'
  })
  @ApiResponse({
    status: 200,
    description: 'Notes retrieved successfully'
  })
  findAll(
    @Query() query: NoteQueryDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.noteService.findAll(query, user)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a note by ID' })
  @ApiResponse({ status: 200, description: 'Note retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Note not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  findOne(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    return this.noteService.findOne(id, user)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a note' })
  @ApiResponse({ status: 200, description: 'Note updated successfully' })
  @ApiResponse({ status: 404, description: 'Note not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  update(
    @Param('id') id: string,
    @Body() updateNoteDto: UpdateNoteDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.noteService.update(id, updateNoteDto, user)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a note' })
  @ApiResponse({ status: 200, description: 'Note deleted successfully' })
  @ApiResponse({ status: 404, description: 'Note not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  remove(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    return this.noteService.remove(id, user)
  }

  @Delete()
  @ApiOperation({
    summary: 'Delete all notes matching the filter criteria'
  })
  @ApiResponse({
    status: 200,
    description: 'Notes deleted successfully'
  })
  @ApiResponse({
    status: 400,
    description: 'At least one filter parameter is required'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  removeAll(
    @Query() query: DeleteAllNotesDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.noteService.removeAll(query, user)
  }
}
