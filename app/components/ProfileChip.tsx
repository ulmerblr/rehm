import Link from "next/link";
import Avatar from "./Avatar";

// The signed-in indicator + the way into Settings, in one tap target. Shows the
// avatar and the username (the local part of the email) so you can see, at a
// glance, that you're signed in as yourself.
export default function ProfileChip({ email }: { email: string | null }) {
  const username = email ? email.split("@")[0] : "account";
  return (
    <Link
      href="/settings"
      className="profile-chip"
      aria-label={email ? `Settings — signed in as ${email}` : "Settings"}
    >
      {email ? <Avatar email={email} size={30} /> : null}
      <span className="profile-chip-name">{username}</span>
    </Link>
  );
}
