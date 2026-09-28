/**
 * The front door.
 *
 * A student lands here when they open `classboard.app` directly instead of the
 * link their CR sent. There is no class to show them, because a class is
 * something you are *given* — there is no directory of classes, and no way to
 * look one up.
 *
 * So this page does one job: say that, and get out of the way. It is deliberately
 * not a marketing page. An explanation of features would be noise for the one
 * person looking at it, who is a student who needs their class link, not
 * somebody deciding whether to sign up.
 *
 * ## Why there is no class list
 *
 * Worth being explicit, because a list is the obvious thing to add here. The
 * rules let any visitor read any *active* class, so that a holder of a link can
 * see it. Listing every class would turn that into a public directory of class
 * names, batches and sections — real information about real students — for
 * anyone who opens the site. The link is the only way in, and this page is
 * where that gets said out loud.
 */

/** Shown to whoever arrives without a link. One sentence, on purpose. */
const NO_LINK = "This page is only useful with a class link. If you don't have one, ask your class representative to send it to you.";

export function HomePage() {
  return (
    <main className="front">
      {/*
        Decorative only. Purely a background wash, hidden from assistive tech —
        the heading and the message below are the whole content of this page.
      */}
      <div className="front__glow" aria-hidden="true" />

      <div className="front__inner">
        <h1 className="front__wordmark">classboard</h1>
        <p className="front__message">{NO_LINK}</p>
      </div>
    </main>
  );
}
