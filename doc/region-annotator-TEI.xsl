<?xml version="1.0" encoding="UTF-8"?>
<?xml-model href="http://www.tei-c.org/release/xml/tei/custom/schema/relaxng/tei_all.rng" type="application/xml" schematypens="http://relaxng.org/ns/structure/1.0"?>
<?xml-model href="http://www.tei-c.org/release/xml/tei/custom/schema/relaxng/tei_all.rng" type="application/xml"
	schematypens="http://purl.oclc.org/dsdl/schematron"?>

<!-- Wolfgang Seifert, Version 08.06.2023, 12.30 Uhr -->

<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:xs="http://www.w3.org/2001/XMLSchema" exclude-result-prefixes="xs" version="2.0">
    <xsl:variable name="var1" select="/"/>
    <!-- $var1 speichert den document node, um ihn in Abfragen verfügbar zu halten, bei denen der Kontext kein node mehr ist. -->
    <xsl:template match="/">
        <xsl:element name="TEI" xmlns="http://www.tei-c.org/ns/1.0">
            <xsl:element name="teiHeader">
                <xsl:element name="fileDesc">
                    <xsl:element name="titleStmt">
                        <xsl:element name="title">Bildannotationen in mittelalterlichen Handschriften der SBB-PK<!-- ausgeschrieben Signatur nach ", "?? // Lt. KL nicht, vmtl, manuell eingetragen, voerste nichts einfügen. --></xsl:element>
                    </xsl:element>
                    <xsl:element name="publicationStmt">
                        <xsl:element name="authority">Erstellt im Rahmen des Datathons der SBB-PK und der FU Berlin</xsl:element>
                        <date>2023</date>
                        <availability>
                            <licence>veröffentlicht unter <xsl:element name="ref"><xsl:attribute name="target">https://creativecommons.org/publicdomain/zero/1.0/</xsl:attribute>CC0 1.0 Universal Licence</xsl:element></licence>
                        </availability>
                    </xsl:element>
                    <xsl:element name="sourceDesc">
                        <xsl:element name="msDesc">
                            <xsl:element name="msIdentifier">
                                <xsl:element name="settlement">Berlin</xsl:element>
                                <xsl:element name="repository">Staatsbibliothek zu Berlin - Preußischer Kulturbesitz</xsl:element>
                                <xsl:element name="idno">### bitte manuell befüllen mit Signatur in Langfassung! ###<!--alternativ: <xsl:for-each select="$var1/root/item/body/item/value[@type = 'str' and starts-with(., 'xml:id=')]">
                                        <xsl:value-of select="concat(substring-before(substring-after(., '='), '_'), ' ', ' ')"/>
                                    </xsl:for-each>-->
                                </xsl:element>
                            </xsl:element>
                        </xsl:element>
                    </xsl:element>
                </xsl:element>
            </xsl:element>
            <!-- 1. Ebene: PPN-Ebene (Handschrift) -->
            <xsl:for-each select="distinct-values(/root/item/target/source/substring-after(substring-before(., '/full'), 'PPN'))">
                <xsl:variable name="var2" select="."/>
                <!-- $var2 nimmt die jeweils gegenständliche PPN auf, um sie für Abfragen innerhalb von Iterationen verfügbar zu halten: Es können damit die im jew. Iterationsdurchlauf relevanten Werte gezielt herausgeklaubt werden. #notieren. Sie repräsentiert ein Werk. -->
                <xsl:element name="sourceDoc">
                    <xsl:attribute name="source">https://content.staatsbibliothek-berlin.de/dc/<xsl:value-of select="."/>/manifest</xsl:attribute>
                    <!-- 2. Ebene: Seitenebene -->
                    <xsl:for-each select="distinct-values($var1/root/item/target/source[contains(., $var2)])">
                        <xsl:variable name="var3" select="."/><!-- $var3 nimmt den Pfad der jew. gegenständlichen jpeg-Datei auf, repräsentiert also eine Seite. -->
                        <xsl:element name="surface">
                            <xsl:attribute name="facs"><xsl:value-of select="."/></xsl:attribute><!-- https://content.staatsbibliothek-berlin.de/dms/PPN<xsl:value-of select="$var2"/>/full/0/<xsl:value-of select="substring(substring-before(., '.jpg'), string-length(.) - 11)"/>.jpg -->
                            <xsl:attribute name="source">https://content.staatsbibliothek-berlin.de/dc/<xsl:value-of select="$var2"/>-<xsl:value-of select="substring(substring-before(., '.jpg'), string-length(.) - 7)"/>/canvas</xsl:attribute>
                            <xsl:attribute name="ulx">0</xsl:attribute>
                            <xsl:attribute name="uly">0</xsl:attribute>
                            <xsl:attribute name="lrx">
                                <xsl:value-of select="$var1/root/item/target/width[@type = 'int' and ancestor::item[body/item/value[@type = 'str' and (text() = 'zone=page' or text() = 'type=page')]] and ancestor::target[source[text() = $var3]]]"/>
                                <!--<xsl:value-of select="$var3"/>-->
                                <!-- $var1/root/item/target/width[@type='int' and ancestor::item[body/item/value[@type = 'str' and (text() = 'zone=page' or text() = 'type=page')]] and ancestor::target[source[text() =  $var3]]] -->
                            </xsl:attribute>
                            <xsl:attribute name="lry">
                                <xsl:value-of select="$var1/root/item/target/height[@type = 'int' and ancestor::item[body/item/value[@type = 'str' and (text() = 'zone=page' or text() = 'type=page')]] and ancestor::target[source[text() = $var3]]]"/>
                            </xsl:attribute>
                            <xsl:element name="zone">
                                <xsl:attribute name="type">page</xsl:attribute>
                                <xsl:attribute name="points">
                                    <xsl:variable name="var5" select="$var1/root/item/target/selector/value[@type = 'str' and ancestor::item[body/item/value[@type = 'str' and (text() = 'zone=page' or text() = 'type=page')]] and ancestor::target[source[text() = $var3]]]"/>
                                    <!-- $var5 identifiziert dasjenige value-Element, welches a) selbst Koordinatenpunkte enthält und b) in dessen übergeordneter Struktur (selber Datensatz) sich sowohl ein value mit Inhalt 'zone=page' als auch die jpeg der soeben gegenständlichen Seite befindet. Die Variable stellt somit die Koordinaten bereit, die sich auf die aktuelle Seite in ihrer Gesamtheit beziehen.-->
                                    <xsl:choose>
                                        <xsl:when test="$var5[contains(., 'xywh')]">
                                            <xsl:value-of select="concat(round(number(tokenize(substring($var5, 12), ',')[1])), ',', round(number(tokenize(substring($var5, 12), ',')[2])), ' ', round(number(tokenize(substring($var5, 12), ',')[1])), ',', round(sum((number(tokenize(substring($var5, 12), ',')[2]), number(tokenize(substring($var5, 12), ',')[4])))), ' ', round(sum((number(tokenize(substring($var5, 12), ',')[1]), number(tokenize(substring($var5, 12), ',')[3])))), ',', round(sum((number(tokenize(substring($var5, 12), ',')[2]), number(tokenize(substring($var5, 12), ',')[4])))), ' ', round(sum((number(tokenize(substring($var5, 12), ',')[1]), number(tokenize(substring($var5, 12), ',')[3])))), ',', round(number(tokenize(substring($var5, 12), ',')[2])))"/>
                                        </xsl:when>
                                        <xsl:otherwise>
                                            <xsl:for-each select="tokenize(substring($var5, 23, string-length($var5) - 32), '\s|,')">
                                                <xsl:value-of select="
                                                        if (position() mod 2 != 0) then
                                                            (concat(round(number(.)), ','))
                                                        else
                                                            (if (position() != last()) then
                                                                (concat(round(number(.)), ' '))
                                                            else
                                                                (round(number(.))))"/>
                                            </xsl:for-each>
                                        </xsl:otherwise>
                                    </xsl:choose>
                                </xsl:attribute>
                                <xsl:attribute name="xml:id">
                                    <xsl:value-of select="substring-after($var1/root/item/body/item/value[starts-with(., 'xml:id') and ancestor::body[following-sibling::target/source[text() = $var3]]], '=')"/>
                                </xsl:attribute>
                                <!-- 3. Ebene: Beschriebene Objekte (Polygone/Vierecke/Wörter) -->
                                <xsl:for-each select="$var1/root/item[child::target/selector/value[contains(., 'polygon') or contains(., 'xywh=') or contains(., 'line=')] and not(child::body/item/value[@type='str' and text()='zone=page']) and child::target/source[text() = $var3]]">
                                    <xsl:variable name="var4" select="."/>
                                    <!-- $var4 enthält das jeweils aktuell abgearbeitete Polygon oder Rectangle, die Variable erlaubt die Orientierung auf 'Datensatzebene'. -->
                                    <xsl:choose>
                                        <xsl:when test="$var4[contains(., 'line')]">
                                            <xsl:element name="line">
                                                <xsl:attribute name="n">
                                                    <xsl:choose>
                                                        <xsl:when test="current()/body/item/value[starts-with(., 'n=')]">
                                                            <xsl:value-of select="substring-after(current()/body/item/value[starts-with(., 'n=')], '=')"/>
                                                        </xsl:when>
                                                        <xsl:when test="current()/body/item/value[starts-with(., 'line=n')]">
                                                            <xsl:value-of select="substring-after(current()/body/item/value[starts-with(., 'line=n')], '=n')"/>
                                                        </xsl:when>
                                                        <xsl:when test="current()/body/item/value[starts-with(., 'line=')]">
                                                            <xsl:value-of select="substring-after(current()/body/item/value[starts-with(., 'line=')], '=')"/>
                                                        </xsl:when>
                                                    </xsl:choose>
                                                </xsl:attribute>
                                                <xsl:attribute name="points">
                                                    <xsl:choose>
                                                        <xsl:when test="$var4/target/selector/type[@type = 'str' and text() = 'FragmentSelector']">
                                                            <xsl:value-of select="concat(round(number(tokenize(substring($var4/target/selector/value[@type = 'str'], 12), ',')[1])), ',', round(number(tokenize(substring($var4/target/selector/value[@type = 'str'], 12), ',')[2])), ' ', round(number(tokenize(substring($var4/target/selector/value[@type = 'str'], 12), ',')[1])), ',', round(sum((number(tokenize(substring($var4/target/selector/value[@type = 'str'], 12), ',')[2]), number(tokenize(substring($var4/target/selector/value[@type = 'str'], 12), ',')[4])))), ' ', round(sum((number(tokenize(substring($var4/target/selector/value[@type = 'str'], 12), ',')[1]), number(tokenize(substring($var4/target/selector/value[@type = 'str'], 12), ',')[3])))), ',', round(sum((number(tokenize(substring($var4/target/selector/value[@type = 'str'], 12), ',')[2]), number(tokenize(substring($var4/target/selector/value[@type = 'str'], 12), ',')[4])))), ' ', round(sum((number(tokenize(substring($var4/target/selector/value[@type = 'str'], 12), ',')[1]), number(tokenize(substring($var4/target/selector/value[@type = 'str'], 12), ',')[3])))), ',', round(number(tokenize(substring($var4/target/selector/value[@type = 'str'], 12), ',')[2])))"/>
                                                        </xsl:when>
                                                        <xsl:otherwise>
                                                            <!--entspricht: when @test="$var4/target/selector/type[@type='str' and text()='SvgSelector']"-->
                                                            <xsl:for-each select="tokenize(substring($var4/target/selector/value[@type = 'str'], 23, string-length($var4/target/selector/value[@type = 'str']) - 32), '\s|,')">
                                                                <xsl:value-of select="
                                                                        if (position() mod 2 != 0) then
                                                                            (concat(round(number(.)), ','))
                                                                        else
                                                                            (if (position() != last()) then
                                                                                (concat(round(number(.)), ' '))
                                                                            else
                                                                                (round(number(.))))"/>
                                                            </xsl:for-each>
                                                        </xsl:otherwise>
                                                    </xsl:choose>
                                                </xsl:attribute>
                                                <xsl:attribute name="xml:id"> <xsl:value-of select="substring-after($var1/root/item/body/item/value[starts-with(., 'xml:id') and ancestor::body[following-sibling::target/source[text() = $var3]]], '=')"/>_<xsl:number count="$var1/root/item[child::target/selector/value[contains(., 'polygon') or contains(., 'xywh=')] | child::body/item/value[contains(., 'line=')] and child::target/source[text() = $var3]]" format="0001"/> </xsl:attribute>
                                                <!--<xsl:element name="w">
                                                    <xsl:for-each select="$var4/body/item/value[starts-with(., 'word=')]">
                                                        <xsl:value-of select="if (position() != last()) then (concat(substring(current(), 6), ' ')) else (substring(current(), 6))"/>
                                                    </xsl:for-each>-->
                                                <!--</xsl:element>-->
                                                <xsl:for-each select="$var4/body/item/value[starts-with(., 'word=')]">
                                                    <xsl:element name="w">
                                                        <xsl:value-of select="substring(current(), 6)"/>
                                                    </xsl:element>
                                                </xsl:for-each>
                                            </xsl:element>
                                        </xsl:when>
                                        <xsl:otherwise>
                                            <xsl:element name="zone">
                                                <xsl:attribute name="type">figure</xsl:attribute>
                                                <xsl:attribute name="points">
                                                    <xsl:choose>
                                                        <xsl:when test="$var4/target/selector/type[@type = 'str' and text() = 'FragmentSelector']">
                                                            <xsl:value-of select="concat(round(number(tokenize(substring($var4/target/selector/value[@type = 'str'], 12), ',')[1])), ',', round(number(tokenize(substring($var4/target/selector/value[@type = 'str'], 12), ',')[2])), ' ', round(number(tokenize(substring($var4/target/selector/value[@type = 'str'], 12), ',')[1])), ',', round(sum((number(tokenize(substring($var4/target/selector/value[@type = 'str'], 12), ',')[2]), number(tokenize(substring($var4/target/selector/value[@type = 'str'], 12), ',')[4])))), ' ', round(sum((number(tokenize(substring($var4/target/selector/value[@type = 'str'], 12), ',')[1]), number(tokenize(substring($var4/target/selector/value[@type = 'str'], 12), ',')[3])))), ',', round(sum((number(tokenize(substring($var4/target/selector/value[@type = 'str'], 12), ',')[2]), number(tokenize(substring($var4/target/selector/value[@type = 'str'], 12), ',')[4])))), ' ', round(sum((number(tokenize(substring($var4/target/selector/value[@type = 'str'], 12), ',')[1]), number(tokenize(substring($var4/target/selector/value[@type = 'str'], 12), ',')[3])))), ',', round(number(tokenize(substring($var4/target/selector/value[@type = 'str'], 12), ',')[2])))"/>
                                                        </xsl:when>
                                                        <xsl:otherwise>
                                                            <!--entspricht: when @test="$var4/target/selector/type[@type='str' and text()='SvgSelector']"-->
                                                            <xsl:for-each select="tokenize(substring($var4/target/selector/value[@type = 'str'], 23, string-length($var4/target/selector/value[@type = 'str']) - 32), '\s|,')">
                                                                <xsl:value-of select="
                                                                        if (position() mod 2 != 0) then
                                                                            (concat(round(number(.)), ','))
                                                                        else
                                                                            (if (position() != last()) then
                                                                                (concat(round(number(.)), ' '))
                                                                            else
                                                                                (round(number(.))))"/>
                                                            </xsl:for-each>
                                                        </xsl:otherwise>
                                                    </xsl:choose>
                                                </xsl:attribute>
                                                <xsl:attribute name="xml:id"><xsl:value-of select="substring-after($var1/root/item/body/item/value[starts-with(., 'xml:id') and ancestor::body[following-sibling::target/source[text() = $var3]]], '=')"/>_<xsl:number count="$var1/root/item[child::target/selector/value[contains(., 'polygon') or contains(., 'xywh=')] | child::body/item/value[contains(., 'line=')] and child::target/source[text() = $var3]]" format="0001"/></xsl:attribute>
                                                <xsl:element name="note">
                                                    <xsl:element name="desc">
                                                        <xsl:attribute name="type">description</xsl:attribute>
                                                        <xsl:value-of select="substring-after(current()/body/item/value[@type = 'str' and starts-with(., 'desc')], '=')"/>
                                                    </xsl:element>
                                                    <xsl:element name="ref">
                                                        <xsl:attribute name="type">iconclass</xsl:attribute>
                                                        <xsl:attribute name="target">
                                                            <xsl:if test="current()/body/item/value[@type = 'str' and starts-with(., 'target')]">
                                                                <xsl:value-of select="
                                                                        if (current()/body/item/value[@type = 'str' and starts-with(., 'target=https://iconclass.org/')]) then
                                                                            (substring-after(current()/body/item/value[@type = 'str' and starts-with(., 'target=')], '='))
                                                                        else
                                                                            (concat('https://iconclass.org/', substring-after(current()/body/item/value[@type = 'str' and starts-with(., 'target=')], '=')))"/>
                                                            </xsl:if>
                                                        </xsl:attribute>
                                                    </xsl:element>
                                                    <!--Option zur Kommentarausgabe, wird nicht gewünscht: 
                                                        <xsl:if test="$var4[body/item/purpose[@type='str' and text()='commenting']]">
                                                            <xsl:element name="note"><xsl:attribute name="type">comment</xsl:attribute><xsl:value-of select="$var4/body/item[child::purpose[text()='commenting']]/value[@type='str']"/>
                                                        </xsl:element>
                                                    </xsl:if>-->
                                                </xsl:element>
                                            </xsl:element>
                                        </xsl:otherwise>
                                    </xsl:choose>
                                </xsl:for-each>
                            </xsl:element>
                        </xsl:element>
                    </xsl:for-each>
                </xsl:element>
            </xsl:for-each>
        </xsl:element>
    </xsl:template>
</xsl:stylesheet>