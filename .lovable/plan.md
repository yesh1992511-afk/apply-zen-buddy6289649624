## Plan

1. Verify the recent profile bug fix did not introduce a compile issue.
   - Check the profile route for syntax/state errors around the changed setter and save flow.
   - Inspect recent dev-server output for the actual timeout/blank-screen cause.

2. Fix the compile timeout root cause with the smallest safe change.
   - If the app is stuck because the dev server/compiler wedged after the previous edit, restart the preview server.
   - If logs show a real code error, patch only the affected file.
   - If the timeout is caused by the recent database constraint migration still not being applied, confirm backend status and prepare the missing migration/action.

3. Validate the user flow.
   - Open the profile page, confirm it loads instead of a blank page.
   - Confirm selecting “F1 OPT” stays selected.
   - Confirm Save changes returns a success/error toast without leaving the app stuck compiling.

## Expected result

The profile page should load normally, the visa status selection should persist locally and after save, and the preview should stop timing out during compilation.