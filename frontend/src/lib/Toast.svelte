<script>
  import { fade } from "svelte/transition";
  import SuccessIcon from "./SuccessIcon.svelte";
  import ErrorIcon from "./ErrorIcon.svelte";
  import InfoIcon from "./InfoIcon.svelte";
  export let type = "error";
</script>

<article class={type} role={type === "error" ? "alert" : "status"} aria-live="polite" transition:fade>
  {#if type === "success"}
    <SuccessIcon width="1.1em" />
  {:else if type === "error"}
    <ErrorIcon width="1.1em" />
  {:else}
    <InfoIcon width="1.1em" />
  {/if}

  <div class="text">
    <slot />
  </div>
</article>

<style lang="scss">
  article {
    position: fixed;
    z-index: 2147483647;
    top: 18%;
    left: 50%;
    box-sizing: border-box;
    color: white;
    padding: 12px 24px;
    border-radius: 3px;
    display: flex;
    justify-content: center;
    align-items: center;
    max-width: min(544px, calc(100vw - 32px));
    word-break: break-word;
    transform: translateX(-50%);
    box-shadow: 0 12px 35px rgb(0 0 0 / 32%);
    font: 15px/1.4 ui-sans-serif, system-ui, sans-serif;
    pointer-events: none;
  }
  .error {
    background: IndianRed;
  }
  .success {
    background: MediumSeaGreen;
  }
  .info {
    background: #423f3f;
  }
  .text {
    margin-left: 16px;
  }
</style>
