import Link from "next/link";
import Image from "next/image";

export function Logo({ href = "/dashboard" }: { href?: string }) {
  return <Link href={href} className="logo"><Image src="/cat-icon.png" alt="" width={30} height={30} className="logo-mark" unoptimized /><span>study tool<span className="logo-period">.</span></span></Link>;
}
