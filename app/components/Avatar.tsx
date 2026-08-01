// A deterministic initials avatar — no upload, no storage. The background hue is
// derived from the email so "you" always look the same, which is enough to show
// you're signed in as yourself. Pure/stateless; safe in a server component.

function hueFromString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

function initials(email: string): string {
  const local = email.split("@")[0] ?? email;
  const parts = local.split(/[.\-_+]/).filter(Boolean);
  const chars =
    parts.length >= 2 ? parts[0][0] + parts[1][0] : local.slice(0, 2);
  return chars.toUpperCase();
}

export default function Avatar({
  email,
  size = 32,
}: {
  email: string;
  size?: number;
}) {
  const hue = hueFromString(email);
  return (
    <span
      aria-hidden="true"
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.42),
        background: `hsl(${hue} 45% 32%)`,
        borderColor: `hsl(${hue} 45% 45%)`,
      }}
    >
      {initials(email)}
    </span>
  );
}
