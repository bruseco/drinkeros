import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCourses, useDeleteCourse } from '@/hooks/useCourses';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, MoreHorizontal, Pencil, Trash2, Loader2, BookOpen } from 'lucide-react';

const AdminCourses: React.FC = () => {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { data: courses = [], isLoading } = useCourses();
  const deleteCourse = useDeleteCourse();

  const handleDelete = async () => {
    if (deleteId) {
      await deleteCourse.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Cursos</h1>
          <p className="text-muted-foreground">Gerencie os cursos (agrupamentos de módulos)</p>
        </div>
        <Button asChild>
          <Link to="/admin/cursos/novo">
            <Plus className="mr-2 h-4 w-4" />
            Novo Curso
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : courses.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">Nenhum curso encontrado</p>
          <Button asChild className="mt-4">
            <Link to="/admin/cursos/novo">
              <Plus className="mr-2 h-4 w-4" />
              Criar primeiro curso
            </Link>
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Curso</TableHead>
                <TableHead>Link Checkout</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {courses.map((course) => (
                <TableRow key={course.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {course.cover_image_url ? (
                        <img
                          src={course.cover_image_url}
                          alt={course.name}
                          className="h-10 w-16 rounded-md object-cover"
                        />
                      ) : (
                        <div className="h-10 w-16 rounded-md bg-muted flex items-center justify-center">
                          <BookOpen className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <span className="font-medium">{course.name}</span>
                        {course.description && (
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {course.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {course.is_free ? (
                      <span className="text-sm text-muted-foreground">-</span>
                    ) : course.hotmart_product_code ? (
                      <a href={course.hotmart_product_code} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm truncate block max-w-[200px]">
                        {course.hotmart_product_code}
                      </a>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={course.is_active ? 'default' : 'secondary'}>
                        {course.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                      {course.is_free && (
                        <Badge variant="outline" className="text-emerald-600 border-emerald-300 bg-emerald-50">
                          Gratuito
                        </Badge>
                      )}
                      {!course.is_free && course.is_available_for_sale && (
                        <Badge variant="outline" className="text-blue-600 border-blue-300 bg-blue-50">
                          À venda
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link to={`/admin/cursos/${course.id}`}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteId(course.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir curso?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O curso será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminCourses;
