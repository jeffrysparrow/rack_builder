import { useEffect, useId, useRef } from 'react';

const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function OrderRequestConfirmation({ reference, rackSubtotalCents, deliveryEstimateCents, emailStatus, rackCount, shopName, headingId, onStartAnother }: {
  reference: string;
  rackSubtotalCents?: number;
  deliveryEstimateCents?: number;
  emailStatus?: string | null;
  rackCount: number;
  shopName: string;
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
      <Heading id={titleId}>Got it! We’ve received your rack request.</Heading>
      <p>We’ll review the details and get in touch to confirm your build and delivery. Thanks for choosing {shopName}.</p>
      <dl>
        <div><dt>Request number</dt><dd>{reference.slice(0, 8).toUpperCase()}</dd></div>
        <div><dt>{rackCount === 1 ? 'Rack requested' : 'Racks requested'}</dt><dd>{rackCount}</dd></div>
        {rackSubtotalCents !== undefined && rackSubtotalCents > 0 && <div>
          <dt>Subtotal before delivery</dt><dd>{dollars.format(rackSubtotalCents / 100)}</dd>
        </div>}
        {deliveryEstimateCents !== undefined && rackSubtotalCents !== undefined && <>
          <div><dt>Estimated delivery</dt><dd>{dollars.format(deliveryEstimateCents / 100)}</dd></div>
          <div><dt>Estimated total</dt><dd>{dollars.format((rackSubtotalCents + deliveryEstimateCents) / 100)}</dd></div>
        </>}
      </dl>
      {emailStatus === 'sent' ? <p>We sent a confirmation email.</p>
        : emailStatus === 'failed' || emailStatus === 'unconfigured'
          ? <p>We couldn’t send a confirmation email. Keep your request number for reference.</p>
          : <p>Keep your request number for reference.</p>}
      {onStartAnother && <button type="button" className="delivery-action delivery-edit" onClick={onStartAnother}>Design another rack</button>}
    </div>
  </section>;
}
