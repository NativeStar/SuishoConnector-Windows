import type { Route } from "./+types/Home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Main Window" },
  ];
}

export default function Home() {
  return (
    <div>Welcome React!</div>
  )
}
