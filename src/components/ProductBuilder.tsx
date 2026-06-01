import type { ProductType } from '../products/types';
import type { StructuredQuoteState } from '../hooks/useStructuredQuote';
import { PresetQuoteBoard } from './PresetQuoteBoard';

export function ProductBuilder({
  state,
  spot,
  onChange,
}: {
  state: StructuredQuoteState;
  spot: number;
  onChange: (state: StructuredQuoteState) => void;
}) {
  const setProduct = (productType: ProductType) => onChange({ ...state, productType });
  const setDual = (patch: Partial<typeof state.dualInput>) =>
    onChange({ ...state, dualInput: { ...state.dualInput, ...patch } });
  const setShark = (patch: Partial<typeof state.sharkInput>) =>
    onChange({ ...state, sharkInput: { ...state.sharkInput, ...patch } });

  return (
    <section className="panel builder">
      <div className="segmented">
        <button
          className={state.productType === 'dual-investment' ? 'active' : ''}
          onClick={() => setProduct('dual-investment')}
          type="button"
        >
          Dual Investment
        </button>
        <button
          className={state.productType === 'shark-fin' ? 'active' : ''}
          onClick={() => setProduct('shark-fin')}
          type="button"
        >
          Shark Fin
        </button>
      </div>
      {state.productType === 'dual-investment' ? (
        <>
          <PresetQuoteBoard spot={spot} onSelectTarget={(targetPrice) => setDual({ targetPrice })} />
          <label>
            Principal
            <input
              value={state.dualInput.principal}
              onChange={(event) => setDual({ principal: Number(event.target.value) })}
            />
          </label>
          <label>
            Target
            <input
              value={state.dualInput.targetPrice}
              onChange={(event) => setDual({ targetPrice: Number(event.target.value) })}
            />
          </label>
          <label>
            Floor
            <input
              value={state.dualInput.floorPrice}
              onChange={(event) => setDual({ floorPrice: Number(event.target.value) })}
            />
          </label>
          <label>
            Step
            <input
              value={state.dualInput.stepSize}
              onChange={(event) => setDual({ stepSize: Number(event.target.value) })}
            />
          </label>
        </>
      ) : (
        <>
          <label>
            Principal
            <input
              value={state.sharkInput.principal}
              onChange={(event) => setShark({ principal: Number(event.target.value) })}
            />
          </label>
          <label>
            Lower bound
            <input
              value={state.sharkInput.lowerBound}
              onChange={(event) => setShark({ lowerBound: Number(event.target.value) })}
            />
          </label>
          <label>
            Upper bound
            <input
              value={state.sharkInput.upperBound}
              onChange={(event) => setShark({ upperBound: Number(event.target.value) })}
            />
          </label>
          <label>
            Base APR
            <input
              value={state.sharkInput.baseApr}
              onChange={(event) => setShark({ baseApr: Number(event.target.value) })}
            />
          </label>
        </>
      )}
    </section>
  );
}
