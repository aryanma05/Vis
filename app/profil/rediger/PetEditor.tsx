"use client";

import { Check, Lock, Shuffle, Trash2 } from "lucide-react";
import Pet from "@/components/pet/Pet";
import PetSvg from "@/components/pet/PetSvg";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { ACHIEVEMENT_BY_KEY, TIER_NAMES } from "@/lib/achievement-defs";
import {
  defaultPet,
  PET_ACCESSORIES,
  PET_ACCESSORY_KEYS,
  PET_COLOR_KEYS,
  PET_COLORS,
  PET_NAME_MAX,
  PET_SPECIES,
  PET_SPECIES_KEYS,
  type PetAccessory,
  type PetConfig,
} from "@/lib/profile-style";

const NAMES = ["Pixel", "Byte", "Kanel", "Luna", "Tuss", "Bolle", "Nugget", "Mocca", "Vaffel", "Kode", "Sprint", "Muffin", "Bit", "Taco", "Pepper"];

const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];

// Hva som skal til for å låse opp tilbehøret, eller null hvis det er åpent.
function lockOf(accessory: PetAccessory, tiers: Record<string, number>) {
  const requires = (PET_ACCESSORIES[accessory] as { requires?: { key: string; tier: number } }).requires;
  if (!requires || (tiers[requires.key] ?? 0) >= requires.tier) return null;
  const name = ACHIEVEMENT_BY_KEY.get(requires.key)?.name ?? requires.key;
  return requires.tier >= 2 ? `${name} (${TIER_NAMES[requires.tier - 1].toLowerCase()})` : name;
}

export default function PetEditor({
  value,
  onChange,
  tiers,
}: {
  value: PetConfig | null;
  onChange: (pet: PetConfig | null) => void;
  // Nivået brukeren har på hver prestasjon, for tilbehør som må låses opp.
  tiers: Record<string, number>;
}) {
  if (!value) {
    return (
      <div>
        <p className="text-sm text-mist">Velg en liten venn. Den sitter på banneret ditt, følger musepekeren med øynene og hilser når noen trykker på den.</p>
        <ul className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-8">
          {PET_SPECIES_KEYS.map((species) => (
            <li key={species}>
              <button
                type="button"
                onClick={() => onChange({ ...defaultPet(species), name: pick(NAMES) })}
                className="group flex w-full flex-col items-center gap-1 rounded-2xl p-2 transition hover:bg-fill"
              >
                <span className="size-16 transition group-hover:-translate-y-1 group-hover:scale-105">
                  <PetSvg pet={defaultPet(species)} wag={false} breathe={false} />
                </span>
                <span className="text-xs text-mist group-hover:text-fg">{PET_SPECIES[species].label}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const set = (patch: Partial<PetConfig>) => onChange({ ...value, ...patch });
  const shuffle = () => {
    const species = pick(PET_SPECIES_KEYS);
    const open = PET_ACCESSORY_KEYS.filter((a) => !lockOf(a, tiers));
    onChange({ species, color: Math.random() < 0.5 ? PET_SPECIES[species].color : pick(PET_COLOR_KEYS), accessory: pick(open), name: pick(NAMES) });
  };

  return (
    <div className="grid gap-6 md:grid-cols-[200px_minmax(0,1fr)]">
      {/* Scenen: trykk på dyret for å hilse. */}
      <div className="flex flex-col items-center">
        <div className="relative flex h-52 w-full items-end justify-center overflow-hidden rounded-[22px] bg-gradient-to-b from-fill to-fill-2 pb-4">
          <div aria-hidden="true" className="absolute inset-x-6 bottom-6 h-3 rounded-full bg-black/10 blur-md" />
          <Pet pet={value} size={150} />
        </div>
        <p className="mt-2 text-center text-xs text-mist">Trykk på {value.name || "dyret"} for å hilse.</p>
      </div>

      <div className="min-w-0 space-y-5">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-fg">Navn</span>
          <input
            className={inputClass}
            value={value.name}
            onChange={(e) => set({ name: e.target.value })}
            maxLength={PET_NAME_MAX}
            placeholder={`F.eks. ${NAMES[0]}`}
          />
        </label>

        <div>
          <span className="mb-2 block text-sm font-medium text-fg">Art</span>
          <div role="radiogroup" aria-label="Art" className="grid grid-cols-4 gap-1.5">
            {PET_SPECIES_KEYS.map((species) => {
              const on = value.species === species;
              return (
                <button
                  key={species}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  title={PET_SPECIES[species].label}
                  onClick={() => set({ species, color: value.species === species ? value.color : PET_SPECIES[species].color })}
                  className={`flex flex-col items-center rounded-xl p-1.5 transition ${on ? "bg-fill-2 ring-2 ring-sea" : "hover:bg-fill"}`}
                >
                  <span className="size-12">
                    <PetSvg pet={{ ...value, species, color: on ? value.color : PET_SPECIES[species].color, accessory: "ingen" }} wag={false} breathe={false} />
                  </span>
                  <span className="text-[11px] text-mist">{PET_SPECIES[species].label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <span className="mb-2 block text-sm font-medium text-fg">Farge</span>
          <div role="radiogroup" aria-label="Farge" className="flex flex-wrap gap-2">
            {PET_COLOR_KEYS.map((key) => {
              const on = value.color === key;
              const c = PET_COLORS[key];
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={c.label}
                  title={c.label}
                  onClick={() => set({ color: key })}
                  className={`flex size-8 items-center justify-center rounded-full ring-1 ring-line transition hover:scale-110 ${on ? "ring-2 ring-sea ring-offset-2 ring-offset-ink" : ""}`}
                  style={{ background: `linear-gradient(135deg, ${c.body} 55%, ${c.shade} 55%)` }}
                >
                  {on && <Check className="size-3.5 text-black/60" strokeWidth={3} />}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <span className="mb-2 block text-sm font-medium text-fg">Tilbehør</span>
          <div role="radiogroup" aria-label="Tilbehør" className="flex flex-wrap gap-2">
            {PET_ACCESSORY_KEYS.map((key) => {
              const on = value.accessory === key;
              const lock = lockOf(key, tiers);
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={Boolean(lock)}
                  title={lock ? `Lås opp med prestasjonen «${lock}»` : undefined}
                  onClick={() => set({ accessory: key })}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    on ? "border-sea/60 bg-sea/10 text-fg" : "border-line text-fg/90 hover:border-mist/50"
                  }`}
                >
                  {lock && <Lock className="size-3.5" />}
                  {PET_ACCESSORIES[key].label}
                </button>
              );
            })}
          </div>
          {PET_ACCESSORY_KEYS.some((k) => lockOf(k, tiers)) && <p className="mt-2 text-[13px] text-mist">Noe tilbehør låses opp med prestasjoner. Hold over for å se hvilke.</p>}
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="secondary" size="sm" onClick={shuffle}>
            <Shuffle className="size-4" /> Tilfeldig
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onChange(null)} className="hover:text-danger">
            <Trash2 className="size-4" /> Fjern kjæledyret
          </Button>
        </div>
      </div>
    </div>
  );
}
