using CollectionGame.Fishing;
using CollectionGame.UI;
using CollectionGame.UI.Views;
using UnityEngine;

namespace CollectionGame.World
{
    /// <summary>
    /// Places the fishing moments of drafts balik-at / -vurus / -cekme next to the player every frame:
    /// the cast meter above the head while F is held, "!" and "Şimdi tıkla!" on a bite, the reel panel
    /// up and left of the player, and the hint line.
    /// </summary>
    public sealed class FishingHud
    {
        readonly FishingView view;

        public FishingHud() => view = UiRoot.Get().Spawn<FishingView>("Fishing");

        public void Destroy()
        {
            if (view != null) Object.Destroy(view.gameObject);
        }

        /// <param name="feet">The player's feet in Unity world space.</param>
        public void Tick(Camera cam, Vector3 feet, Vector2 serverPos, FishingController fishing)
        {
            if (view == null || cam == null) return;
            var ui = UiRoot.Get();
            var screen = cam.WorldToScreenPoint(feet);
            RectTransformUtility.ScreenPointToLocalPointInRectangle(ui.Rect, screen, null, out var local);
            var at = local - ui.Rect.rect.min; // canvas units from the bottom-left corner

            var state = fishing.State;
            var charging = state == FishingController.Phase.Charging;
            var biting = state == FishingController.Phase.Bite;
            var reeling = fishing.Reel != null && (state == FishingController.Phase.Reeling || state == FishingController.Phase.Judging);

            Show(view.charge, charging, at + new Vector2(0, 64)); // balik-at: box bottom 64 above the feet
            if (charging)
            {
                view.SetCharge(fishing.Charge);
            }
            Show(view.bite, biting, at + new Vector2(0, 76));
            Show(view.reel, reeling, at + new Vector2(-90, 0)); // balik-cekme: panel beside the player, feet level
            if (reeling)
            {
                var r = fishing.Reel;
                var h = view.water.rect.height;
                var bar = r.Params.barSize / (float)ReelModel.Field * h;
                view.bar.sizeDelta = new Vector2(view.bar.sizeDelta.x, bar);
                view.bar.anchoredPosition = new Vector2(0, r.Bar / (float)ReelModel.Field * h);
                view.fish.anchoredPosition = new Vector2(0, r.Fish / (float)ReelModel.Field * h - view.fish.rect.height / 2f);
                view.progressFill.anchorMax = new Vector2(1, Mathf.Clamp01(r.Progress / (float)ReelModel.Field));
            }

            var hint = fishing.Hint(serverPos);
            var hintOn = !string.IsNullOrEmpty(hint);
            var hintAt = charging ? at + new Vector2(110, -8) : reeling ? at + new Vector2(-90, -4) : at - new Vector2(0, 6);
            Show(view.hint, hintOn, hintAt);
            if (hintOn && view.hintText.text != hint) view.hintText.text = hint;
        }

        static void Show(RectTransform rt, bool on, Vector2 at)
        {
            if (rt.gameObject.activeSelf != on) rt.gameObject.SetActive(on);
            if (on) rt.anchoredPosition = new Vector2(Mathf.Round(at.x), Mathf.Round(at.y));
        }
    }
}
