import { getGuideOffer } from "@/lib/growth";
import GuidePopup from "./GuidePopup";

/** Adds the free guide popup when a guide is chosen in Admin → Settings → Lead capture. */
export default async function GuidePopupLoader() {
  const offer = await getGuideOffer();
  return offer ? <GuidePopup title={offer.title} /> : null;
}
