# Guard - https://github.com/guard/guard
#
# Install:
# sudo gem install guard guard-shell growl
#
# Usage:
# guard
# ---------------------------------------------------------------

# Buster JavaScript tests #
guard :shell do
   buster_config = "test/buster.js"
   buster_port = 1111
   buster_url = "http://localhost:#{buster_port}/capture"

   system("buster server -p #{buster_port} &")
   puts "\nGo to #{buster_url} to capture Buster test slave\n\n"

   watch(%r{^test/.*-test\.js$}) do |m|
       test_run_output = `buster test -c #{buster_config} 2>&1`
       puts "\n#{test_run_output}\n\n"
       if test_run_output.include? "Failed"
           n "#{buster_url}", "Buster Test: #{test_run_output}", :failed
       end
       if test_run_output.include? "Failure" or test_run_output.include? "Error:"
           n "#{m[0]} failed", "Buster Test Errors", :failed
       end
   end
end
