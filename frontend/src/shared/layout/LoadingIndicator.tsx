import './LoadingIndicator.css';

export function LoadingIndicator() {
  return (
    <div className="loading" role="status">
      <span className="loading__spinner" aria-hidden="true" />
      Cargando…
    </div>
  );
}
