import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { ApiError, api, useGet } from '../../shared/api';
import { LoadingIndicator } from '../../shared/layout/LoadingIndicator';
import '../../shared/ui/page.css';

interface Program {
  id: number;
  name: string;
  location: string;
  status: 'ACTIVE' | 'INACTIVE';
}

interface Subject {
  id: number;
  code: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  program: { id: number; name: string };
}

interface Term {
  id: number;
  year: number;
  term: number;
}

interface Teacher {
  id: number;
  loginId: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
}

interface Section {
  id: number;
  name: string;
  status: 'OPEN' | 'CLOSED';
  subject: { code: string; name: string };
  term: Term;
  teachingAssignments: { position: string; user: { loginId: string; firstName: string; lastName: string } }[];
}

function useMessage() {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  return {
    error,
    message,
    async run(action: () => Promise<void>) {
      setError(null);
      setMessage(null);
      try {
        await action();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Ocurrió un error inesperado.');
      }
    },
    setMessage,
  };
}

function Banners({ error, message }: { error: string | null; message: string | null }) {
  return (
    <>
      {error && <p className="banner banner--error">{error}</p>}
      {message && <p className="banner banner--success">{message}</p>}
    </>
  );
}

export function ProgramsPage() {
  const list = useGet<{ programs: Program[] }>('/api/programs');
  const notice = useMessage();
  if (!list.data) return list.error ? <p className="banner banner--error">{list.error}</p> : <LoadingIndicator />;

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    await notice.run(async () => {
      await api.post('/api/programs', { name: form.get('name'), location: form.get('location') });
      notice.setMessage('Carrera creada.');
      list.reload();
      formElement.reset();
    });
  }

  return (
    <section className="page">
      <h1 className="page__title">Carreras</h1>
      <Banners error={notice.error} message={notice.message} />
      <form className="card row" onSubmit={create}>
        <label className="field">
          Nombre
          <input name="name" required />
        </label>
        <label className="field">
          Sede
          <input name="location" required />
        </label>
        <button className="button" type="submit">
          Crear
        </button>
      </form>
      <table className="table">
        <tbody>
          {list.data.programs.map((program) => (
            <tr key={program.id}>
              <td>
                {program.name} · {program.location}
              </td>
              <td>{program.status === 'ACTIVE' ? 'Activa' : 'Inactiva'}</td>
              <td>
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() =>
                    void notice.run(async () => {
                      await api.patch(`/api/programs/${program.id}/status`, {
                        status: program.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
                      });
                      list.reload();
                    })
                  }
                >
                  {program.status === 'ACTIVE' ? 'Pasar a inactiva' : 'Reactivar'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function SubjectsPage() {
  const list = useGet<{ subjects: Subject[] }>('/api/subjects');
  const programs = useGet<{ programs: Program[] }>('/api/programs');
  const notice = useMessage();
  if (!list.data || !programs.data) {
    return list.error || programs.error ? (
      <p className="banner banner--error">{list.error ?? programs.error}</p>
    ) : (
      <LoadingIndicator />
    );
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await notice.run(async () => {
      await api.post('/api/subjects', {
        programId: Number(form.get('programId')),
        code: form.get('code'),
        name: form.get('name'),
      });
      notice.setMessage('Materia creada.');
      list.reload();
    });
  }

  return (
    <section className="page">
      <h1 className="page__title">Materias</h1>
      <Banners error={notice.error} message={notice.message} />
      <form className="card row" onSubmit={create}>
        <label className="field">
          Carrera
          <select name="programId" required>
            {programs.data.programs
              .filter((program) => program.status === 'ACTIVE')
              .map((program) => (
                <option key={program.id} value={program.id}>
                  {program.name}
                </option>
              ))}
          </select>
        </label>
        <label className="field">
          Código
          <input name="code" required />
        </label>
        <label className="field">
          Nombre
          <input name="name" required />
        </label>
        <button className="button" type="submit">
          Crear
        </button>
      </form>
      <table className="table">
        <tbody>
          {list.data.subjects.map((subject) => (
            <tr key={subject.id}>
              <td>
                {subject.code} · {subject.name}
                <div className="muted">{subject.program.name}</div>
              </td>
              <td>{subject.status === 'ACTIVE' ? 'Activa' : 'Inactiva'}</td>
              <td>
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() =>
                    void notice.run(async () => {
                      await api.patch(`/api/subjects/${subject.id}/status`, {
                        status: subject.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
                      });
                      list.reload();
                    })
                  }
                >
                  {subject.status === 'ACTIVE' ? 'Pasar a inactiva' : 'Reactivar'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function TermsPage() {
  const list = useGet<{ terms: Term[] }>('/api/terms');
  const notice = useMessage();
  if (!list.data) return list.error ? <p className="banner banner--error">{list.error}</p> : <LoadingIndicator />;

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await notice.run(async () => {
      await api.post('/api/terms', { year: Number(form.get('year')), term: Number(form.get('term')) });
      notice.setMessage('Período creado.');
      list.reload();
    });
  }

  return (
    <section className="page">
      <h1 className="page__title">Períodos lectivos</h1>
      <Banners error={notice.error} message={notice.message} />
      <form className="card row" onSubmit={create}>
        <label className="field">
          Año
          <input name="year" type="number" required min={2000} max={2100} />
        </label>
        <label className="field">
          Cuatrimestre
          <select name="term" defaultValue="1">
            <option value="1">1</option>
            <option value="2">2</option>
          </select>
        </label>
        <button className="button" type="submit">
          Crear
        </button>
      </form>
      <ul>
        {list.data.terms.map((term) => (
          <li key={term.id}>
            {term.year} · cuatrimestre {term.term}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function SectionsPage() {
  const sections = useGet<{ sections: Section[] }>('/api/sections');
  const subjects = useGet<{ subjects: Subject[] }>('/api/subjects');
  const terms = useGet<{ terms: Term[] }>('/api/terms');
  const users = useGet<{ users: Teacher[] }>('/api/users');
  const notice = useMessage();
  if (!sections.data || !subjects.data || !terms.data || !users.data) {
    return <LoadingIndicator />;
  }
  const teachers = users.data.users.filter((user) => user.role === 'TEACHER' && user.status === 'ACTIVE');

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const leadId = Number(form.get('leadId'));
    const assistantRaw = String(form.get('assistantId') ?? '');
    const staff = [{ userId: leadId, position: 'LEAD' }];
    if (assistantRaw !== '') staff.push({ userId: Number(assistantRaw), position: 'ASSISTANT' });
    await notice.run(async () => {
      await api.post('/api/sections', {
        subjectId: Number(form.get('subjectId')),
        termId: Number(form.get('termId')),
        name: form.get('name'),
        teachers: staff,
      });
      notice.setMessage('Comisión abierta. El aula ya está creada.');
      sections.reload();
    });
  }

  return (
    <section className="page">
      <h1 className="page__title">Comisiones</h1>
      <Banners error={notice.error} message={notice.message} />
      <form className="card row" onSubmit={create}>
        <label className="field">
          Materia activa
          <select name="subjectId" required>
            {subjects.data.subjects
              .filter((subject) => subject.status === 'ACTIVE')
              .map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.code} · {subject.name}
                </option>
              ))}
          </select>
        </label>
        <label className="field">
          Período
          <select name="termId" required>
            {terms.data.terms.map((term) => (
              <option key={term.id} value={term.id}>
                {term.year} C{term.term}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Nombre
          <input name="name" required />
        </label>
        <label className="field">
          Titular
          <select name="leadId" required>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.lastName}, {teacher.firstName}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Auxiliar
          <select name="assistantId" defaultValue="">
            <option value="">Sin auxiliar</option>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.lastName}, {teacher.firstName}
              </option>
            ))}
          </select>
        </label>
        <button className="button" type="submit">
          Abrir comisión
        </button>
      </form>
      {sections.data.sections.map((section) => (
        <article className="card" key={section.id}>
          <strong>
            {section.subject.code} · {section.name}
          </strong>
          <span className="muted">
            {section.term.year} C{section.term.term} · {section.status === 'OPEN' ? 'Abierta' : 'Cerrada'}
          </span>
          <span className="muted">
            {section.teachingAssignments
              .map((item) => `${item.user.lastName} (${item.position === 'LEAD' ? 'titular' : 'auxiliar'})`)
              .join(', ')}
          </span>
          <div className="actions">
            <Link to={`/sections/${section.id}`}>Aula</Link>
            <Link to={`/sections/${section.id}/sheet`}>Planilla</Link>
            <Link to={`/sections/${section.id}/enrollments`}>Inscripciones</Link>
            {section.status === 'OPEN' && (
              <button
                type="button"
                className="button button--secondary"
                onClick={() =>
                  void notice.run(async () => {
                    await api.post(`/api/sections/${section.id}/close`);
                    notice.setMessage('Comisión cerrada. No se vuelve a abrir.');
                    sections.reload();
                  })
                }
              >
                Cerrar
              </button>
            )}
          </div>
        </article>
      ))}
    </section>
  );
}

const MIME_OPTIONS = [
  ['application/pdf', 'PDF'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'DOCX'],
  ['application/zip', 'ZIP'],
  ['image/jpeg', 'JPG'],
  ['image/png', 'PNG'],
] as const;

export function SettingsPage() {
  const settings = useGet<{
    settings: { currentTermId: number | null; maxFileSizeBytes: number; allowedMimeTypes: string[] };
  }>('/api/settings');
  const terms = useGet<{ terms: Term[] }>('/api/terms');
  const notice = useMessage();
  if (!settings.data || !terms.data) return <LoadingIndicator />;
  const current = settings.data.settings;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const term = String(form.get('currentTermId'));
    await notice.run(async () => {
      await api.patch('/api/settings', {
        currentTermId: term === '' ? null : Number(term),
        maxFileSizeBytes: Number(form.get('maxFileSizeBytes')),
        allowedMimeTypes: form.getAll('mime'),
      });
      notice.setMessage('Parámetros guardados.');
      settings.reload();
    });
  }

  return (
    <section className="page">
      <h1 className="page__title">Parámetros</h1>
      <Banners error={notice.error} message={notice.message} />
      <form className="card stack" onSubmit={save}>
        <label className="field">
          Período vigente
          <select name="currentTermId" defaultValue={current.currentTermId ?? ''}>
            <option value="">Sin período</option>
            {terms.data.terms.map((term) => (
              <option key={term.id} value={term.id}>
                {term.year} C{term.term}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Tamaño máximo de un archivo (bytes)
          <input name="maxFileSizeBytes" type="number" required defaultValue={current.maxFileSizeBytes} />
        </label>
        <fieldset className="stack">
          <legend>Tipos permitidos</legend>
          {MIME_OPTIONS.map(([value, label]) => (
            <label key={value}>
              <input type="checkbox" name="mime" value={value} defaultChecked={current.allowedMimeTypes.includes(value)} />{' '}
              {label}
            </label>
          ))}
        </fieldset>
        <button className="button" type="submit">
          Guardar
        </button>
      </form>
    </section>
  );
}
