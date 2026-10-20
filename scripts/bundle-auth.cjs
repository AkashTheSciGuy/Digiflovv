require("esbuild").buildSync({
  entryPoints: [require("node:path").join(__dirname, "../src/supabase-client.js")],
  bundle: true, minify: true, format: "iife", platform: "browser",
  outfile: require("node:path").join(__dirname, "../dist/vendor/supabase.js"),
  legalComments: "linked"
});
