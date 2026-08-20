import { Label } from "@/components/ui/label";
import type { CommercialTier } from "@eoda/database";
import { formatStartingPrice } from "@/lib/services/price-format-service";

type FormuleOption = { formule: CommercialTier; label: string; priceEuros: number };

type Props = {
  formules: FormuleOption[];
  defaultFormule?: CommercialTier;
  defaultGratuit?: boolean;
  disabled?: boolean;
};

export function FormuleOfferPicker({ formules, defaultFormule, defaultGratuit, disabled }: Props) {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>
          Offre <span className="text-rouge-imp">*</span>
        </Label>
        <div className="space-y-2">
          {formules.map((f) => (
            <label
              key={f.formule}
              className="flex items-center justify-between gap-3 border border-gris-light rounded-md px-3 py-2.5 text-sm cursor-pointer has-[:checked]:border-terre has-[:checked]:bg-terre/5"
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="formule"
                  value={f.formule}
                  defaultChecked={defaultFormule ? defaultFormule === f.formule : f.formule === "ESSENTIEL"}
                  disabled={disabled}
                  required
                  className="accent-terre"
                />
                {f.label}
              </span>
              <span className="text-gris-mid tabular-nums">
                {formatStartingPrice({ priceEuros: f.priceEuros })}
              </span>
            </label>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-brun-ancre cursor-pointer">
        <input
          type="checkbox"
          name="gratuit"
          defaultChecked={defaultGratuit}
          disabled={disabled}
          className="accent-terre"
        />
        Mission bêta-test gratuite (accorde le périmètre Excellence complet)
      </label>
    </div>
  );
}
