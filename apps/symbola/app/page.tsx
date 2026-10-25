import { getGreeting } from "@/modules/hello/service";

export default function HomePage() {
  const greeting = getGreeting();

  return (
    <main>
      <h1>Symbola</h1>
      <p>{greeting.message}</p>
    </main>
  );
}
