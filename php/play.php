<?php
$loanData = file_get_contents('loanData.php');

$loanArray = print_r_reverse(trim($loanData));

function print_r_reverse(&$output)
{
    $expecting = 0; // 0=nothing in particular, 1=array open paren '(', 2=array element or close paren ')'
    $lines = explode("\n", $output);
    $result = null;
    $topArray = null;
    $arrayStack = array();
    $matches = null;
    while (!empty($lines) && $result === null)
    {
        $line = array_shift($lines);
        $trim = trim($line);
        if ($trim == 'Array')
        {
            if ($expecting == 0)
            {
                $topArray = array();
                $expecting = 1;
            }
            else
            {
                trigger_error("Unknown array.");
            }
        }
        else if ($expecting == 1 && $trim == '(')
        {
            $expecting = 2;
        }
        else if ($expecting == 2 && preg_match('/^\[(.+?)\] \=\> (.+)$/', $trim, $matches)) // array element
        {
            list ($fullMatch, $key, $element) = $matches;
            if (trim($element) == 'Array')
            {
                $topArray[$key] = array();
                $newTopArray =& $topArray[$key];
                $arrayStack[] =& $topArray;
                $topArray =& $newTopArray;
                $expecting = 1;
            }
            else
            {
                $topArray[$key] = $element;
            }
        }
        else if ($expecting == 2 && $trim == ')') // end current array
        {
            if (empty($arrayStack))
            {
                $result = $topArray;
            }
            else // pop into parent array
            {
                // safe array pop
                $keys = array_keys($arrayStack);
                $lastKey = array_pop($keys);
                $temp =& $arrayStack[$lastKey];
                unset($arrayStack[$lastKey]);
                $topArray =& $temp;
            }
        }
        // Added this to allow for multi line strings.
    else if (!empty($trim) && $expecting == 2)
    {
        // Expecting close parent or element, but got just a string
        $topArray[$key] .= "\n".$line;
    }
        else if (!empty($trim))
        {
            $result = $line;
        }
    }

    $output = implode("\n", $lines);
    return $result;
}


foreach($loanArray as $key => $val) {
    echo "$key "."-- Ayman \n";
    print_r($val);
}


?>