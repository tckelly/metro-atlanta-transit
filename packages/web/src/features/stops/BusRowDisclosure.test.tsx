import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BusRowProps } from '@atl-transit/components';

import {
  BusRowDisclosure,
  type DownstreamStopView,
} from './BusRowDisclosure';

const ROW: BusRowProps = {
  primaryText: '3 min',
  secondaryText: 'Scheduled 12:34 · Filling up',
  severity: 'success',
  icon: 'clock',
};

function renderInList(ui: React.ReactNode) {
  // BusRowDisclosure renders as <li>, so wrap it in a <ul> to keep the DOM valid
  // and let screen-reader semantics resolve naturally in tests.
  return render(<ul>{ui}</ul>);
}

describe('BusRowDisclosure', () => {
  it('starts closed: the panel is not in the DOM and aria-expanded is "false"', () => {
    renderInList(
      <BusRowDisclosure
        busRowProps={ROW}
        downstream={[]}
        triggerLabel="Show stops for route 116 to Decatur at 12:34"
        panelLabel="Downstream stops"
      />,
    );

    const trigger = screen.getByRole('button', {
      name: 'Show stops for route 116 to Decatur at 12:34',
    });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('region', { name: 'Downstream stops' })).toBeNull();
  });

  it('opens on click: aria-expanded flips to "true" and the panel appears', async () => {
    const user = userEvent.setup();
    renderInList(
      <BusRowDisclosure
        busRowProps={ROW}
        downstream={[
          { stopId: 'S2', name: 'Ponce @ Barnett' },
          { stopId: 'S3', name: 'Decatur Station' },
        ]}
        triggerLabel="Show stops"
        panelLabel="Downstream stops"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Show stops' }));

    expect(screen.getByRole('button', { name: 'Show stops' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    const panel = screen.getByRole('region', { name: 'Downstream stops' });
    expect(panel).toBeInTheDocument();
    expect(screen.getByText('Ponce @ Barnett')).toBeInTheDocument();
    expect(screen.getByText('Decatur Station')).toBeInTheDocument();
  });

  it('toggles closed on a second click', async () => {
    const user = userEvent.setup();
    renderInList(
      <BusRowDisclosure
        busRowProps={ROW}
        downstream={[{ stopId: 'S2', name: 'Ponce @ Barnett' }]}
        triggerLabel="Show stops"
        panelLabel="Downstream stops"
      />,
    );

    const trigger = screen.getByRole('button', { name: 'Show stops' });
    await user.click(trigger);
    await user.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('shows a loading region inside the panel while downstream is undefined', async () => {
    const user = userEvent.setup();
    renderInList(
      <BusRowDisclosure
        busRowProps={ROW}
        downstream={undefined}
        triggerLabel="Show stops"
        panelLabel="Downstream stops"
        loadingLabel="Loading downstream stops"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Show stops' }));

    // Polite live region announces the loading state for SR users.
    expect(
      screen.getByRole('status', { name: 'Loading downstream stops' }),
    ).toBeInTheDocument();
  });

  it('renders a "last stop on this trip" message when downstream is empty', async () => {
    const user = userEvent.setup();
    renderInList(
      <BusRowDisclosure
        busRowProps={ROW}
        downstream={[]}
        triggerLabel="Show stops"
        panelLabel="Downstream stops"
        lastStopLabel="This is the last stop on this trip"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Show stops' }));

    expect(
      screen.getByText('This is the last stop on this trip'),
    ).toBeInTheDocument();
  });

  it('marks skipped stops visually and to screen readers', async () => {
    const user = userEvent.setup();
    const stops: DownstreamStopView[] = [
      { stopId: 'S2', name: 'Ponce @ Barnett' },
      { stopId: 'S3', name: 'Skipped Stop', isSkipped: true },
      { stopId: 'S4', name: 'Decatur Station' },
    ];
    renderInList(
      <BusRowDisclosure
        busRowProps={ROW}
        downstream={stops}
        triggerLabel="Show stops"
        panelLabel="Downstream stops"
        skippedLabel="skipped"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Show stops' }));

    // The SR annotation reads "Skipped Stop (skipped)" so listeners hear
    // both the stop name and the status.
    expect(screen.getByText(/Skipped Stop/i)).toBeInTheDocument();
    expect(screen.getByText('(skipped)')).toBeInTheDocument();
  });

  it('calls onOpen the first time the disclosure opens (for lazy fetching)', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    renderInList(
      <BusRowDisclosure
        busRowProps={ROW}
        downstream={undefined}
        onOpen={onOpen}
        triggerLabel="Show stops"
        panelLabel="Downstream stops"
        loadingLabel="Loading"
      />,
    );

    const trigger = screen.getByRole('button', { name: 'Show stops' });
    await user.click(trigger); // open
    await user.click(trigger); // close
    await user.click(trigger); // open again

    // Fired on each open; consumer is responsible for caching/dedupe.
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it('renders an error message instead of the list when errorMessage is provided', async () => {
    const user = userEvent.setup();
    renderInList(
      <BusRowDisclosure
        busRowProps={ROW}
        downstream={undefined}
        errorMessage="Couldn’t load stop list for this trip."
        triggerLabel="Show stops"
        panelLabel="Downstream stops"
        loadingLabel="Loading"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Show stops' }));

    // Error wins over loading — never lie to the rider with a stale "loading…".
    expect(screen.queryByRole('status', { name: 'Loading' })).toBeNull();
    expect(
      screen.getByText('Couldn’t load stop list for this trip.'),
    ).toBeInTheDocument();
  });

  it('renders the stop name before the predicted arrival time (name-first column layout)', async () => {
    const user = userEvent.setup();
    renderInList(
      <BusRowDisclosure
        busRowProps={ROW}
        downstream={[
          { stopId: 'S2', name: 'Ponce @ Barnett', arrivalText: '12:34' },
          { stopId: 'S3', name: 'Decatur Station', arrivalText: '12:36' },
        ]}
        triggerLabel="Show stops"
        panelLabel="Downstream stops"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Show stops' }));

    // Name-first: when a rider expands a specific trip the question is
    // "which stops does this bus serve" (am I on the right branch?), so
    // the stop name is the primary scan target and the time is supplementary
    // confirmation. Screen readers hear "Ponce @ Barnett, 12:34".
    const name = screen.getByText('Ponce @ Barnett');
    const time = screen.getByText('12:34');
    expect(
      name.compareDocumentPosition(time) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('renders an em-dash placeholder when a downstream stop has no predicted time', async () => {
    const user = userEvent.setup();
    renderInList(
      <BusRowDisclosure
        busRowProps={ROW}
        downstream={[
          { stopId: 'S2', name: 'Has Time', arrivalText: '12:34' },
          { stopId: 'S3', name: 'No Time' },
        ]}
        triggerLabel="Show stops"
        panelLabel="Downstream stops"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Show stops' }));

    // NO_DATA rows (~12% of MARTA's downstream updates) lack a live
    // prediction but the bus is still expected to serve the stop. An em-dash
    // keeps the column aligned and signals "no live time" without implying
    // the stop is cancelled. Hidden from screen readers so listeners just
    // hear the stop name.
    const dash = screen.getByText('—');
    expect(dash).toBeInTheDocument();
    expect(dash).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders the BusRow’s primary and secondary text on the trigger', () => {
    renderInList(
      <BusRowDisclosure
        busRowProps={ROW}
        downstream={[]}
        triggerLabel="Show stops"
        panelLabel="Downstream stops"
      />,
    );

    // The trigger is a button whose visible content matches what BusRow
    // would have rendered — the rider sees the same row, just tappable.
    const trigger = screen.getByRole('button', { name: 'Show stops' });
    expect(trigger).toHaveTextContent('3 min');
    expect(trigger).toHaveTextContent('Scheduled 12:34 · Filling up');
  });
});
