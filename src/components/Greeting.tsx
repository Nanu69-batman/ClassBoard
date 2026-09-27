function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function Greeting() {
  return (
    <div className="greeting">
      <h1 className="greeting__title">
        {getGreeting()} <span aria-hidden="true">👋</span>
      </h1>
      <p className="greeting__subtitle">Here's what you need to get done.</p>
    </div>
  );
}
