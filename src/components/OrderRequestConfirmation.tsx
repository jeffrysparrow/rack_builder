import { useEffect, useId, useRef } from 'react';

const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function OrderRequestConfirmation({ reference, rackSubtotalCents, deliveryEstimateCents, headingId, onStartAnother }: {
  reference: string;
  rackSubtotalCents?: number;
  deliveryEstimateCents?: number;
  headingId?: string;
  onStartAnother?: () => void;
}) {
  const card = useRef<HTMLElement>(null);
  const dialogHeadingId = useId();
  const Heading = headingId ? 'h2' : 'h3';
  const titleId = headingId ?? dialogHeadingId;

  useEffect(() => {
    card.current?.focus({ preventScroll: true });
    card.current?.scrollIntoView({ block: 'start' });
  }, []);

  return <section ref={card} className="request-confirmation" tabIndex={-1} aria-labelledby={titleId}>
    <span className="request-confirmation-mark" aria-hidden="true">✓</span>
    <div>
      <Heading id={titleId}>Order request received</Heading>
      <p>Your builder will contact you using the details you shared, review your rack options, and send a quote. You’ll confirm the final price, delivery window, and any payment arrangements before your builder starts work. No payment was collected.</p>
      <dl>
        <div><dt>Request reference</dt><dd>{reference.slice(0, 8).toUpperCase()}</dd></div>
        {rackSubtotalCents !== undefined && rackSubtotalCents > 0 && <div>
          <dt>Subtotal before delivery</dt><dd>{dollars.format(rackSubtotalCents / 100)}</dd>
        </div>}
        {deliveryEstimateCents !== undefined && rackSubtotalCents !== undefined && <>
          <div><dt>Estimated delivery</dt><dd>{dollars.format(deliveryEstimateCents / 100)}</dd></div>
          <div><dt>Estimated total</dt><dd>{dollars.format((rackSubtotalCents + deliveryEstimateCents) / 100)}</dd></div>
        </>}
      </dl>
      {onStartAnother && <button type="button" className="delivery-action delivery-edit" onClick={onStartAnother}>Start another order request</button>}
    </div>
  </section>;
}
