import { useState, type FormEvent } from 'react';
import { useParams } from 'react-router';
import { ApiError, api, downloadFile, useGet } from '../../shared/api';
import { LoadingIndicator } from '../../shared/layout/LoadingIndicator';
import { useSession } from '../../shared/session';
import '../../shared/ui/page.css';

interface Attachment {
  id: number;
  fileName: string;
}

interface ClassroomResponse {
  classroom: {
    section: { id: number; name: string; status: 'OPEN' | 'CLOSED'; passingGrade: number | null };
    canManage: boolean;
    canSubmit: boolean;
    canGrade: boolean;
    materials: { id: number; title: string; description: string; attachments: Attachment[] }[];
    announcements: { id: number; title: string; body: string; publishedAt: string }[];
    activities: {
      id: number;
      type: 'ASSIGNMENT' | 'ASSESSMENT';
      title: string;
      description: string;
      status: 'PUBLISHED' | 'CLOSED';
      dueAt: string | null;
      attachments: Attachment[];
      mySubmission: { id: number; timeliness: 'ON_TIME' | 'LATE'; status: string; attachment: Attachment | null } | null;
      myGrade: { value: number; observation: string | null; withoutSubmission: boolean; approved: boolean | null } | null;
    }[];
  };
}

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(iso));
}

export function ClassroomPage() {
  const { sectionId = '' } = useParams();
  const { user } = useSession();
  const classroom = useGet<ClassroomResponse>(`/api/sections/${sectionId}/classroom`);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>): Promise<boolean> {
    setError(null);
    try {
      await action();
      classroom.reload();
      return true;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ocurrió un error inesperado.');
      return false;
    }
  }

  if (!classroom.data) {
    return classroom.error ? <p className="banner banner--error">{classroom.error}</p> : <LoadingIndicator />;
  }
  const data = classroom.data.classroom;

  function filesOf(form: FormData) {
    const body = new FormData();
    for (const [key, value] of form.entries()) {
      if (typeof value === 'string' && value === '') continue;
      if (value instanceof File && value.size === 0) continue;
      body.append(key, value);
    }
    return body;
  }

  return (
    <section className="page">
      <h1 className="page__title">Aula · {data.section.name}</h1>
      <p className="page__lead">{data.section.status === 'OPEN' ? 'Comisión abierta' : 'Comisión cerrada'}</p>
      {error && <p className="banner banner--error">{error}</p>}

      <article className="card stack">
        <h2>Anuncios</h2>
        {data.canManage && (
          <form
            className="stack"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const formElement = event.currentTarget;
              const form = new FormData(formElement);
              void run(async () => {
                await api.post(`/api/sections/${sectionId}/announcements`, {
                  title: form.get('title'),
                  body: form.get('body'),
                });
                formElement.reset();
              });
            }}
          >
            <label className="field">
              Título
              <input name="title" required />
            </label>
            <label className="field">
              Cuerpo
              <textarea name="body" required />
            </label>
            <button className="button" type="submit">
              Publicar anuncio
            </button>
          </form>
        )}
        {data.announcements.map((item) => (
          <div key={item.id}>
            <strong>{item.title}</strong>
            <p>{item.body}</p>
            <span className="muted">{formatWhen(item.publishedAt)} (hora de Argentina)</span>
            {data.canManage && (
              <EditBox
                fields={[
                  { name: 'title', label: 'Título', value: item.title },
                  { name: 'body', label: 'Cuerpo', value: item.body, multiline: true },
                ]}
                onSave={(form) =>
                  run(() =>
                    api.patch(`/api/sections/${sectionId}/announcements/${item.id}`, {
                      title: form.get('title'),
                      body: form.get('body'),
                    }),
                  )
                }
              />
            )}
            {data.canManage && (
              <button type="button" className="button button--secondary" onClick={() => void run(() => api.post(`/api/sections/${sectionId}/announcements/${item.id}/withdraw`))}>
                Retirar
              </button>
            )}
          </div>
        ))}
      </article>

      <article className="card stack">
        <h2>Material</h2>
        {data.canManage && (
          <form
            className="stack"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const formElement = event.currentTarget;
              const form = filesOf(new FormData(formElement));
              void run(async () => {
                await api.postForm(`/api/sections/${sectionId}/materials`, form);
                formElement.reset();
              });
            }}
          >
            <label className="field">
              Título
              <input name="title" required />
            </label>
            <label className="field">
              Descripción
              <textarea name="description" required />
            </label>
            <label className="field">
              Archivos
              <input name="files" type="file" multiple />
            </label>
            <button className="button" type="submit">
              Publicar material
            </button>
          </form>
        )}
        {data.materials.map((item) => (
          <div key={item.id}>
            <strong>{item.title}</strong>
            <p>{item.description}</p>
            {item.attachments.map((file) => (
              <span key={file.id} className="actions">
                <button type="button" className="button button--secondary" onClick={() => void downloadFile(`/api/attachments/${file.id}`, file.fileName)}>
                  {file.fileName}
                </button>
                {data.canManage && (
                  <button type="button" className="button button--secondary" onClick={() => void run(() => api.delete(`/api/attachments/${file.id}`))}>
                    Quitar
                  </button>
                )}
              </span>
            ))}
            {data.canManage && (
              <EditBox
                fields={[
                  { name: 'title', label: 'Título', value: item.title },
                  { name: 'description', label: 'Descripción', value: item.description, multiline: true },
                ]}
                onSave={(form) =>
                  run(() =>
                    api.patch(`/api/sections/${sectionId}/materials/${item.id}`, {
                      title: form.get('title'),
                      description: form.get('description'),
                    }),
                  )
                }
              />
            )}
            {data.canManage && (
              <button type="button" className="button button--secondary" onClick={() => void run(() => api.post(`/api/sections/${sectionId}/materials/${item.id}/withdraw`))}>
                Retirar
              </button>
            )}
            {data.canManage && (
              <form
                className="row"
                onSubmit={(event: FormEvent<HTMLFormElement>) => {
                  event.preventDefault();
                  const formElement = event.currentTarget;
                  const form = filesOf(new FormData(formElement));
                  void run(async () => {
                    await api.postForm(`/api/sections/${sectionId}/materials/${item.id}/files`, form);
                    formElement.reset();
                  });
                }}
              >
                <label className="field">
                  Agregar archivos
                  <input name="files" type="file" multiple required />
                </label>
                <button className="button button--secondary" type="submit">
                  Subir
                </button>
              </form>
            )}
          </div>
        ))}
      </article>

      <article className="card stack">
        <h2>Actividades</h2>
        {data.canManage && (
          <form
            className="stack"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const formElement = event.currentTarget;
              const form = filesOf(new FormData(formElement));
              void run(async () => {
                await api.postForm(`/api/sections/${sectionId}/activities`, form);
                formElement.reset();
              });
            }}
          >
            <label className="field">
              Tipo
              <select name="type" defaultValue="ASSIGNMENT">
                <option value="ASSIGNMENT">Trabajo práctico</option>
                <option value="ASSESSMENT">Evaluación</option>
              </select>
            </label>
            <label className="field">
              Título
              <input name="title" required />
            </label>
            <label className="field">
              Descripción
              <textarea name="description" required />
            </label>
            <label className="field">
              Fecha límite (hora de Argentina, solo trabajos prácticos)
              <input name="dueAt" type="datetime-local" />
            </label>
            <label className="field">
              Consigna
              <input name="files" type="file" multiple />
            </label>
            <button className="button" type="submit">
              Crear actividad
            </button>
          </form>
        )}
        {data.activities.map((activity) => (
          <div className="card" key={activity.id}>
            <strong>
              {activity.title} · {activity.type === 'ASSIGNMENT' ? 'Trabajo práctico' : 'Evaluación'}
            </strong>
            <p>{activity.description}</p>
            {activity.dueAt && <span className="muted">Límite: {formatWhen(activity.dueAt)}</span>}
            <span className="muted">{activity.status === 'CLOSED' ? 'Cerrada' : 'Publicada'}</span>
            {activity.attachments.map((file) => (
              <span key={file.id} className="actions">
                <button type="button" className="button button--secondary" onClick={() => void downloadFile(`/api/attachments/${file.id}`, file.fileName)}>
                  {file.fileName}
                </button>
                {data.canManage && activity.status === 'PUBLISHED' && (
                  <button type="button" className="button button--secondary" onClick={() => void run(() => api.delete(`/api/attachments/${file.id}`))}>
                    Quitar
                  </button>
                )}
              </span>
            ))}
            {data.canManage && (
              <EditBox
                fields={[
                  { name: 'title', label: 'Título', value: activity.title },
                  { name: 'description', label: 'Descripción', value: activity.description, multiline: true },
                  ...(activity.type === 'ASSIGNMENT'
                    ? [{ name: 'dueAt', label: 'Nueva fecha límite (hora de Argentina)', value: '' }]
                    : []),
                ]}
                onSave={(form) =>
                  run(() =>
                    api.patch(`/api/sections/${sectionId}/activities/${activity.id}`, {
                      title: form.get('title'),
                      description: form.get('description'),
                      ...(form.get('dueAt') ? { dueAt: form.get('dueAt') } : {}),
                    }),
                  )
                }
              />
            )}
            {data.canManage && activity.status === 'PUBLISHED' && (
              <form
                className="row"
                onSubmit={(event: FormEvent<HTMLFormElement>) => {
                  event.preventDefault();
                  const formElement = event.currentTarget;
                  const form = filesOf(new FormData(formElement));
                  void run(async () => {
                    await api.postForm(`/api/sections/${sectionId}/activities/${activity.id}/files`, form);
                    formElement.reset();
                  });
                }}
              >
                <label className="field">
                  Agregar consigna
                  <input name="files" type="file" multiple required />
                </label>
                <button className="button button--secondary" type="submit">
                  Subir
                </button>
              </form>
            )}
            {user?.role === 'STUDENT' && activity.mySubmission && (
              <span className="muted">
                Tu entrega: {activity.mySubmission.timeliness === 'ON_TIME' ? 'a tiempo' : 'tarde'} ·{' '}
                {activity.mySubmission.status === 'GRADED' ? 'calificada' : 'entregada'}
              </span>
            )}
            {user?.role === 'STUDENT' && activity.myGrade && (
              <span>
                Nota: {activity.myGrade.value}
                {activity.myGrade.withoutSubmission ? ' (sin entrega)' : ''}
                {activity.myGrade.approved === null ? '' : activity.myGrade.approved ? ' · aprobada' : ' · no aprobada'}
              </span>
            )}
            {data.canSubmit && activity.type === 'ASSIGNMENT' && activity.status === 'PUBLISHED' && activity.mySubmission?.status !== 'GRADED' && !activity.myGrade && (
              <form
                onSubmit={(event: FormEvent<HTMLFormElement>) => {
                  event.preventDefault();
                  const form = filesOf(new FormData(event.currentTarget));
                  void run(() => api.postForm(`/api/activities/${activity.id}/submission`, form));
                }}
              >
                <label className="field">
                  {activity.mySubmission ? 'Reemplazar archivo' : 'Entregar'}
                  <input name="file" type="file" required />
                </label>
                <button className="button" type="submit">
                  Enviar
                </button>
              </form>
            )}
            {data.canManage && activity.status === 'PUBLISHED' && (
              <button type="button" className="button button--secondary" onClick={() => void run(() => api.post(`/api/sections/${sectionId}/activities/${activity.id}/close`))}>
                Cerrar actividad
              </button>
            )}
          </div>
        ))}
      </article>
    </section>
  );
}

function EditBox({
  fields,
  onSave,
}: {
  fields: { name: string; label: string; value: string; multiline?: boolean }[];
  onSave: (form: FormData) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" className="button button--secondary" onClick={() => setOpen(true)}>
        Editar
      </button>
    );
  }
  return (
    <form
      className="stack"
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const form = event.currentTarget;
        void onSave(new FormData(form)).then((saved) => {
          if (saved) setOpen(false);
        });
      }}
    >
      {fields.map((field) => (
        <label className="field" key={field.name}>
          {field.label}
          {field.multiline ? (
            <textarea name={field.name} required defaultValue={field.value} />
          ) : (
            <input
              name={field.name}
              type={field.name === 'dueAt' ? 'datetime-local' : 'text'}
              required={field.name !== 'dueAt'}
              defaultValue={field.value}
            />
          )}
        </label>
      ))}
      <button className="button" type="submit">
        Guardar
      </button>
    </form>
  );
}
