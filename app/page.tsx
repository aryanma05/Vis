import Link from "next/link";
import GradientWaves from "@/components/GradientWaves";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#1b1035] text-white">
      <div className="absolute inset-0">
        <GradientWaves
          horizonColor="#071A52"
          waveColor="#086788"
          crestColor="#C7F9FF"
          speed={0.4}
          amplitude={2.5}
          waveScale={0.6}
          waveRatio={0.9}
          swell={35}
          turbulence={20}
          tilt={1.11}
          zoom={1}
          height={5.5}
          fogDepth={15}
          detail="medium"
          brightness={1}
          opacity={1}
          mouseInteraction
          parallaxStrength={0.5}
          grain
          grainIntensity={0.05}
        />
      </div>

      <section className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-6 text-center">
        <div className="rounded-full border border-white/25 bg-black/15 px-4 py-2 text-sm text-white/85 backdrop-blur">
          For utviklere, designere og digitale skapere
        </div>

        <h1 className="mt-6 max-w-4xl text-5xl font-bold tracking-tight md:text-7xl">
          Vis ditt verk.
          <br />
          Vis deg selv.
        </h1>

        <p className="mt-6 max-w-2xl text-lg text-white/85">
          Vis samler din CV, dine prosjekter og digitale identitet i en visuell
          profil.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/register"
            className="rounded-lg bg-white px-6 py-3 font-medium text-black transition hover:bg-gray-200"
          >
            Kom i gang
          </Link>

          <Link
            href="/profil/aryan"
            className="rounded-lg border border-white/35 bg-black/15 px-6 py-3 font-medium text-white backdrop-blur transition hover:bg-white/10"
          >
            Se eksempelprofil
          </Link>
        </div>
      </section>
    </main>
  );
}