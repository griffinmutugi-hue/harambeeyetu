import assert from "node:assert/strict";
import test from "node:test";
import { isApprovedCampaignPhotoPath } from "./campaigns";

test("campaign photos are limited to their owner's folder or known campaign artwork", () => {
  const ownerId = "5a98b679-d324-44f9-beaf-6d4dc5fab413";

  assert.equal(isApprovedCampaignPhotoPath(`${ownerId}/campaign.png`, ownerId), true);
  assert.equal(isApprovedCampaignPhotoPath("seed/campaign-medical.jpg", null), true);
  assert.equal(isApprovedCampaignPhotoPath("organizers/av1.jpg", null), true);
  assert.equal(isApprovedCampaignPhotoPath("seed/private-file.jpg", ownerId), false);
  assert.equal(isApprovedCampaignPhotoPath("another-user/photo.png", ownerId), false);
  assert.equal(isApprovedCampaignPhotoPath("https://example.com/photo.jpg", ownerId), false);
});