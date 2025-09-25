export default function Wrapper({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <main className="px-5">{children}</main>;
}
