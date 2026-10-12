// Short reassuring copy shown above the sign-up form. Presentational only.
export default function SignupWelcome() {
  return (
    <section aria-labelledby="signup-welcome" className="mt-4 text-lg leading-relaxed text-spruce/90">
      <h2 id="signup-welcome" className="sr-only">
        What to expect
      </h2>
      <p>Welcome. It takes about a minute, and you can go at your own pace.</p>
      <ul className="mt-4 space-y-2">
        <li>
          <strong>What you get:</strong> a calm place to log eating, sleep, movement and how you feel, with goals that are yours.
        </li>
        <li>
          <strong>What we do not collect:</strong> no ads, no insurer or provider connection, and nothing you are not comfortable adding.
        </li>
        <li>
          <strong>Your data is yours:</strong> download it or delete everything whenever you like.
        </li>
      </ul>
    </section>
  );
}
