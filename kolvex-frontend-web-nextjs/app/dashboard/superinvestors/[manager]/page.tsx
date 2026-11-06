import SuperinvestorDetail from "@/components/superinvestors/SuperinvestorDetail";

export const metadata = {
  title: "Superinvestor holdings · Kolvex",
  robots: { index: false, follow: false },
};

export default function Page({ params }: { params: { manager: string } }) {
  return <SuperinvestorDetail manager={decodeURIComponent(params.manager)} />;
}
