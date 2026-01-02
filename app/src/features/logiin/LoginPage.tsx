type LoginPageProps = {
  onSignIn: () => Promise<void>;
};

export function LoginPage({ onSignIn }: LoginPageProps) {
  return (
    <main className="time-tracker">
      <div className="time-tracker__panel">
        <header className="time-tracker__header">
          <h1>Forge</h1>
        </header>
        <button type="button" className="time-tracker__action" onClick={onSignIn}>
          Google でログイン
        </button>
      </div>
    </main>
  );
}
